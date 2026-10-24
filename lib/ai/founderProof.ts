/**
 * Founder-submitted proof for the milestone tracker. D's /api/tracker/[token] calls this after
 * Roundtable clears the session: fetch the page, label it with labeler-v2 (quote check included).
 * The result is stored as source "founder"; lib/scoring.ts caps it at 0.6.
 */
import type { PassRisk, ProofLabel } from "../types";
import { labelProofPoint } from "./labeler";

const FETCH_TIMEOUT_MS = 8000;
const MAX_PAGE_CHARS = 200_000;

export type FounderProofResult = { label: ProofLabel; quote: string } | { error: string };

/** The URL comes from the public, so only fetch ordinary public web pages. */
function isFetchable(url: URL): boolean {
  if (url.protocol !== "https:" && url.protocol !== "http:") return false;
  const h = url.hostname.toLowerCase();
  return !(
    h === "localhost" ||
    h.endsWith(".local") ||
    h.endsWith(".internal") ||
    /^(127|10|0)\./.test(h) ||
    /^192\.168\./.test(h) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(h) ||
    /^169\.254\./.test(h) ||
    h.includes(":")
  );
}

function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export async function labelFounderProof(
  urlString: string,
  risk: PassRisk,
  deal: { companyName: string; passDate: string; dealId: string },
): Promise<FounderProofResult> {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    return { error: "That link doesn't look right." };
  }
  if (!isFetchable(url)) return { error: "That link doesn't look right." };

  let text: string;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), redirect: "follow" });
    if (!res.ok) return { error: "We couldn't open that link." };
    text = htmlToText((await res.text()).slice(0, MAX_PAGE_CHARS));
  } catch {
    return { error: "We couldn't open that link." };
  }

  const today = new Date().toISOString().slice(0, 10);
  const l = await labelProofPoint(
    risk.riskCode,
    { title: url.hostname, summary: "", fullText: text, publishedDate: today, sourceName: "Sent by the founder" },
    { version: "v2", passDate: deal.passDate, companyName: deal.companyName, sessionId: `founder-${deal.dealId}` },
  );
  return { label: l.label, quote: l.quote };
}
