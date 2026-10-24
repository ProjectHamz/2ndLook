/**
 * akta.pro (by Wokelo) client — Part B.
 *
 * Server-side only. Reads AKTA_API_KEY from the environment and sends it as the
 * `x-api-key` header (NOT a Bearer token).
 *
 * The HTTP transport, throttle, fixture capture and 403/429 handling below are
 * final. The endpoint PATHS and request/response field names marked `VERIFY:`
 * are my best reading of the build-plan API table and MUST be confirmed against
 * the Akta Playground / docs before prefetch is trusted — adjust the `EP` paths
 * and the small mapping functions, nothing else.
 *
 * Pay-as-you-go limits (from the plan): 25 req/min hard cap, so we throttle to 20.
 * List Generation returns at most 20 companies with no enrichment.
 */
import { promises as fs } from "node:fs";
import path from "node:path";

const BASE_URL = (process.env.AKTA_BASE_URL || "https://api.akta.pro").replace(/\/+$/, "");

const EP = {
  // CONFIRMED from Akta docs: GET /api/v1/news/?company=<companyId>&unique_article=false
  // Envelope: { status: "success", total: n, data: [ { title, published_date, publisher, ai_summary, url } ] }
  newsSignals: "/api/v1/news/",
  // VERIFY: still unconfirmed. Paths follow the /api/v1/ prefix the news endpoint uses.
  companySearch: "/api/v1/company/search/",
  companyData: "/api/v1/company/",
  filterBuilder: "/api/v1/filter-builder/",
  listGeneration: "/api/v1/list/",
} as const;

export type AktaReason = "no_api_key" | "forbidden" | "rate_limited" | "http_error" | "network_error" | "empty";

/** Every call returns data OR a reason, never throws. UI turns a reason into "No coverage". */
export type AktaResult<T> = { data: T; reason: null } | { data: null; reason: AktaReason };

export type AktaCompany = { id: string; name: string; domain: string | null };

export type AktaNewsItem = {
  title: string;
  /** Akta's ai_summary. Also the quotable text, since no full article body is returned. */
  summary: string;
  fullText: string;
  url: string;
  /** YYYY-MM-DD */
  publishedDate: string;
  /** Who published the article, e.g. "TechCrunch". */
  publisher: string;
  /** True when this company is the item's primary company (vs. a passing mention). */
  primaryCompany: boolean;
  /** Akta's event/signal tags, lowercased. Empty if the payload carries none. */
  tags: string[];
};

export type AktaSection = { section: string; text: string; url: string; asOf: string };

const SECTIONS_ALLOWED = ["product_offering", "customer_profile", "management_profile", "strategic_signal"] as const;

// ---------------------------------------------------------------------------
// Throttle: at most 20 requests per rolling minute, FIFO.
// ---------------------------------------------------------------------------
const MAX_PER_MIN = 20;
let timestamps: number[] = [];
let chain: Promise<void> = Promise.resolve();

function reserveSlot(): Promise<void> {
  chain = chain.then(async () => {
    for (;;) {
      const now = Date.now();
      timestamps = timestamps.filter((t) => now - t < 60_000);
      if (timestamps.length < MAX_PER_MIN) {
        timestamps.push(now);
        return;
      }
      const waitMs = 60_000 - (now - timestamps[0]!) + 20;
      await new Promise((r) => setTimeout(r, waitMs));
    }
  });
  return chain;
}

// ---------------------------------------------------------------------------
// Fixture capture: during prefetch we persist every raw response so the
// deployed app (read-only FS) can replay them. Enabled by AKTA_CAPTURE=1.
// ---------------------------------------------------------------------------
const CAPTURE = process.env.AKTA_CAPTURE === "1";
const FIXTURE_DIR = path.join(process.cwd(), "data", "fixtures", "akta");

async function capture(fn: string, key: string, payload: unknown): Promise<void> {
  if (!CAPTURE) return;
  try {
    await fs.mkdir(FIXTURE_DIR, { recursive: true });
    const safe = key.replace(/[^a-z0-9._-]/gi, "_").slice(0, 120);
    await fs.writeFile(path.join(FIXTURE_DIR, `${fn}-${safe}.json`), JSON.stringify(payload, null, 2), "utf8");
  } catch {
    // Capturing fixtures must never break a prefetch run.
  }
}

async function call<T>(
  fn: keyof typeof EP,
  init: { method: "GET" | "POST"; query?: Record<string, string>; body?: unknown },
  captureKey: string,
  map: (json: any) => T,
): Promise<AktaResult<T>> {
  const apiKey = process.env.AKTA_API_KEY;
  if (!apiKey) return { data: null, reason: "no_api_key" };

  await reserveSlot();

  const url = new URL(BASE_URL + EP[fn]);
  for (const [k, v] of Object.entries(init.query ?? {})) url.searchParams.set(k, v);

  try {
    const res = await fetch(url, {
      method: init.method,
      headers: {
        "x-api-key": apiKey,
        ...(init.body ? { "Content-Type": "application/json" } : {}),
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
    });

    if (res.status === 403) return { data: null, reason: "forbidden" };
    if (res.status === 429) return { data: null, reason: "rate_limited" };
    if (!res.ok) return { data: null, reason: "http_error" };

    const json = await res.json();
    await capture(fn, captureKey, json);
    return { data: map(json), reason: null };
  } catch {
    return { data: null, reason: "network_error" };
  }
}

// ---------------------------------------------------------------------------
// Public API (names from the build-plan table).
// ---------------------------------------------------------------------------

/** Company Search — free. Resolve a domain to Akta's company record (cache the UUID). */
export async function resolveCompany(domain: string): Promise<AktaResult<AktaCompany>> {
  if (!domain) return { data: null, reason: "empty" };
  return call(
    "companySearch",
    { method: "GET", query: { domain } }, // VERIFY: param name (domain vs website vs query)
    domain,
    (j): AktaCompany => {
      const c = j?.company ?? j?.companies?.[0] ?? j?.data?.[0] ?? j;
      return { id: String(c?.id ?? c?.uuid ?? ""), name: c?.name ?? "", domain: c?.domain ?? domain };
    },
  );
}

/**
 * News for one company, filtered to items published AFTER the pass date.
 *
 * Takes Akta's COMPANY ID (e.g. "00000l1"), not a domain — resolve it with
 * resolveCompany() first. The documented endpoint exposes no date or limit
 * parameter, so we filter client-side rather than send params that may 400.
 *
 * `primaryCompany` defaults to true because we queried this company's id
 * directly; it is overridden if the payload carries an explicit flag.
 */
export async function getNewsSince(companyId: string, passDate: string): Promise<AktaResult<AktaNewsItem[]>> {
  if (!companyId) return { data: null, reason: "empty" };

  const res = await call(
    "newsSignals",
    { method: "GET", query: { company: companyId, unique_article: "false" } },
    companyId,
    (j): AktaNewsItem[] => {
      const items: any[] = Array.isArray(j?.data) ? j.data : [];
      return items.map((n) => {
        const summary = n?.ai_summary ?? n?.summary ?? n?.description ?? "";
        return {
          title: n?.title ?? "",
          summary,
          // No full-article text is documented; ai_summary is the quotable text.
          fullText: n?.full_text ?? n?.body ?? n?.content ?? summary,
          url: n?.url ?? n?.link ?? "",
          publishedDate: normDate(n?.published_date ?? n?.date ?? n?.published_at ?? ""),
          primaryCompany: typeof n?.is_primary_company === "boolean" ? n.is_primary_company : true,
          tags: toTags(n?.tags ?? n?.categories ?? n?.event_type ?? n?.signal_type),
          publisher: n?.publisher ?? "",
        };
      });
    },
  );

  if (res.reason) return res;
  // Keep only items after the pass date, newest first.
  const fresh = res.data
    .filter((n) => n.publishedDate && n.publishedDate > passDate)
    .sort((a, b) => (a.publishedDate < b.publishedDate ? 1 : -1));
  return { data: fresh, reason: null };
}

/** Company Data — only the four pay-as-you-go-safe sections. Never funding/M&A (403). */
export async function getCompanySections(domain: string): Promise<AktaResult<AktaSection[]>> {
  if (!domain) return { data: null, reason: "empty" };
  return call(
    "companyData",
    { method: "GET", query: { domain, sections: SECTIONS_ALLOWED.join(",") } }, // VERIFY: param names
    domain,
    (j): AktaSection[] => {
      const secs: any[] = j?.sections ?? j?.data ?? [];
      return secs
        .filter((s) => SECTIONS_ALLOWED.includes(s?.section))
        .map((s) => ({ section: s?.section, text: s?.text ?? s?.content ?? "", url: s?.url ?? "", asOf: normDate(s?.as_of ?? "") }));
    },
  );
}

/** Filter Builder — plain English to a filter object for List Generation. */
export async function describeTarget(text: string): Promise<AktaResult<unknown>> {
  if (!text) return { data: null, reason: "empty" };
  return call(
    "filterBuilder",
    { method: "POST", body: { query: text } }, // VERIFY: body shape
    text.slice(0, 60),
    (j) => j?.filters ?? j?.filter ?? j,
  );
}

/** List Generation — synchronous, <=20 companies, no enrichment on pay-as-you-go. */
export async function findCompanies(filters: unknown): Promise<AktaResult<AktaCompany[]>> {
  return call(
    "listGeneration",
    { method: "POST", body: { filters, limit: 20 } }, // VERIFY: body shape
    hashKey(filters),
    (j): AktaCompany[] => {
      const list: any[] = j?.companies ?? j?.data ?? j?.results ?? [];
      return list.slice(0, 20).map((c) => ({
        id: String(c?.id ?? c?.uuid ?? ""),
        name: c?.name ?? "",
        domain: c?.domain ?? null,
      }));
    },
  );
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
function normDate(s: string): string {
  if (!s) return "";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

function toTags(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x).toLowerCase());
  if (typeof v === "string") return [v.toLowerCase()];
  return [];
}

function hashKey(v: unknown): string {
  const s = JSON.stringify(v) ?? "";
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return `filters_${(h >>> 0).toString(36)}`;
}
