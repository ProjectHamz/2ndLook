/**
 * akta.pro (by Wokelo) client — Part B.
 *
 * Server-side only. Reads AKTA_API_KEY from the environment and sends it as the
 * `x-api-key` header (NOT a Bearer token).
 *
 * Endpoint paths and field names checked against docs.akta.pro and live calls (Oct 24).
 * News on our plan only reaches back 187 days, so getNewsSince starts at the later of
 * the pass date and that window (older requests are a 403).
 *
 * Pay-as-you-go limits (from the plan): 25 req/min hard cap, so we throttle to 20.
 * List Generation returns at most 20 companies with no enrichment.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { normalizeDomain } from "./passlog/normalize";

const BASE_URL = (process.env.AKTA_BASE_URL || "https://api.akta.pro/api").replace(/\/+$/, "");

const EP = {
  companySearch: "/v1/company/search",
  newsSignals: "/v1/news",
  companyData: "/v1/company/enrichment",
  filterBuilder: "/v1/list/filter-builder/",
  listGeneration: "/v1/list/generate/companies/",
} as const;

/** Our plan's news window; one day of margin under the 187-day limit. */
const NEWS_WINDOW_DAYS = 186;

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
const FIXTURE_DIR = path.join(process.cwd(), "data", "fixtures", "akta");

async function capture(fn: string, key: string, payload: unknown): Promise<void> {
  // Read at call time: prefetch sets AKTA_CAPTURE after this module is imported.
  if (process.env.AKTA_CAPTURE !== "1") return;
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
    { method: "GET", query: { query: domain } },
    domain,
    (j): AktaCompany => {
      const c = j?.data?.[0];
      return { id: String(c?.uuid ?? ""), name: c?.name ?? "", domain: normalizeDomain(c?.website) || domain };
    },
  );
}

/**
 * News Signals since the pass date. Tries primary_company first; if empty, falls
 * back to any mention (`company`). Caps at 25 items.
 */
export async function getNewsSince(domain: string, passDate: string): Promise<AktaResult<AktaNewsItem[]>> {
  if (!domain) return { data: null, reason: "empty" };
  const windowStart = new Date(Date.now() - NEWS_WINDOW_DAYS * 86_400_000).toISOString().slice(0, 10);
  const startDate = passDate > windowStart ? passDate : windowStart;

  const run = (mode: "primary" | "mention") =>
    call(
      "newsSignals",
      {
        method: "GET",
        query: {
          [mode === "primary" ? "primary_company" : "company"]: domain,
          start_date: startDate,
          limit: "25",
        },
      },
      `${domain}-${mode}`,
      (j): AktaNewsItem[] => {
        const items: any[] = j?.data ?? [];
        // The same story often appears several times (syndication); keep the first of each title.
        const seen = new Set<string>();
        return items
          .filter((n) => {
            const key = String(n?.title ?? "").trim().toLowerCase();
            if (!key || seen.has(key)) return false;
            seen.add(key);
            return true;
          })
          .map((n) => ({
            title: n?.title ?? "",
            summary: n?.ai_summary ?? "",
            fullText: n?.full_text ?? n?.ai_summary ?? "",
            url: n?.url ?? "",
            publishedDate: normDate(n?.published_date ?? ""),
            primaryCompany: mode === "primary",
            tags: toTags(n?.tags),
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
    { method: "GET", query: { company: `https://${domain}`, sections: SECTIONS_ALLOWED.join(",") } },
    domain,
    (j): AktaSection[] => {
      // `data` is one object keyed by section name. Sections carry no date, so asOf stays "".
      const data = j?.data ?? {};
      return SECTIONS_ALLOWED.filter((name) => data[name]).map((name) => ({
        section: name,
        text: sectionText(data[name]),
        url: `https://${domain}`,
        asOf: "",
      }));
    },
  );
}

/** Filter Builder — plain English to a filter object for List Generation. */
export async function describeTarget(text: string): Promise<AktaResult<unknown>> {
  if (!text) return { data: null, reason: "empty" };
  return call(
    "filterBuilder",
    { method: "POST", body: { query: text } },
    text.slice(0, 60),
    (j) => j?.data?.filters ?? null,
  );
}

/** List Generation — synchronous, <=20 companies, no enrichment on pay-as-you-go. */
export async function findCompanies(filters: unknown): Promise<AktaResult<AktaCompany[]>> {
  return call(
    "listGeneration",
    { method: "POST", body: { filters, limit: 20 } },
    hashKey(filters),
    (j): AktaCompany[] => {
      const list: any[] = j?.data ?? [];
      return list.slice(0, 20).map((c) => ({
        id: String(c?.uuid ?? ""),
        name: c?.name ?? "",
        domain: normalizeDomain(c?.website) || null,
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

/** Akta tags are objects like { name: "Mergers & Acquisitions", code, is_primary }. */
function toTags(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x: any) => String(x?.name ?? x).toLowerCase());
  if (typeof v === "string") return [v.toLowerCase()];
  return [];
}

/** Flattens a company-data section object into "key: value" lines for the labeler. */
function sectionText(v: unknown, prefix = ""): string {
  if (v == null) return "";
  if (typeof v !== "object") return `${prefix}${String(v)}`;
  if (Array.isArray(v)) return v.map((x) => sectionText(x, prefix)).filter(Boolean).join("\n");
  return Object.entries(v as Record<string, unknown>)
    .map(([k, x]) => (typeof x === "object" && x !== null ? sectionText(x, `${k.replace(/_/g, " ")}: `) : `${k.replace(/_/g, " ")}: ${String(x)}`))
    .filter(Boolean)
    .join("\n");
}

function hashKey(v: unknown): string {
  const s = JSON.stringify(v) ?? "";
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return `filters_${(h >>> 0).toString(36)}`;
}
