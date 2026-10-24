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

// VERIFY: endpoint paths against the Akta Playground.
const EP = {
  companySearch: "/v1/company/search",
  newsSignals: "/v1/signals/news",
  companyData: "/v1/company/sections",
  filterBuilder: "/v1/list/filter-builder",
  listGeneration: "/v1/list/generate",
} as const;

export type AktaReason = "no_api_key" | "forbidden" | "rate_limited" | "http_error" | "network_error" | "empty";

/** Every call returns data OR a reason, never throws. UI turns a reason into "No coverage". */
export type AktaResult<T> = { data: T; reason: null } | { data: null; reason: AktaReason };

export type AktaCompany = { id: string; name: string; domain: string | null };

export type AktaNewsItem = {
  title: string;
  summary: string;
  fullText: string;
  url: string;
  /** YYYY-MM-DD */
  publishedDate: string;
  /** True when this company is the item's primary_company (vs. a passing mention). */
  primaryCompany: boolean;
  /** Akta's event/signal tags, lowercased. Used by scoring to match a risk. */
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
 * News Signals since the pass date. Tries primary_company first; if empty, falls
 * back to any mention (`company`). Caps at 25 items.
 */
export async function getNewsSince(domain: string, passDate: string): Promise<AktaResult<AktaNewsItem[]>> {
  if (!domain) return { data: null, reason: "empty" };

  const run = (mode: "primary" | "mention") =>
    call(
      "newsSignals",
      {
        method: "GET",
        query: {
          [mode === "primary" ? "primary_company" : "company"]: domain, // VERIFY: param names
          start_date: passDate,
          limit: "25",
        },
      },
      `${domain}-${mode}`,
      (j): AktaNewsItem[] => {
        const items: any[] = j?.news ?? j?.signals ?? j?.data ?? [];
        return items.map((n) => ({
          title: n?.title ?? "",
          summary: n?.summary ?? n?.description ?? "",
          fullText: n?.full_text ?? n?.body ?? n?.content ?? n?.summary ?? "",
          url: n?.url ?? n?.link ?? "",
          publishedDate: normDate(n?.published_date ?? n?.date ?? n?.published_at ?? ""),
          primaryCompany: mode === "primary",
          tags: toTags(n?.tags ?? n?.event_type ?? n?.signal_type),
        }));
      },
    );

  const primary = await run("primary");
  if (primary.reason) return primary;
  if (primary.data.length > 0) return primary;
  return run("mention");
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
