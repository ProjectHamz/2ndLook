/**
 * Guard against made-up proof. A proof point only counts if its quote appears
 * word for word in the source text, after normalizing whitespace, quote marks
 * and dashes. Anything that fails is relabeled "irrelevant" and logged.
 */

/** Quotes shorter than this match too easily by accident ("the product"). */
const MIN_QUOTE_WORDS = 4;

export function normalizeForQuote(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/[‘’‚‛′]/g, "'")
    .replace(/[“”„‟″]/g, '"')
    .replace(/[‐-―−]/g, "-")
    .replace(/…/g, "...")
    .replace(/\s+/g, " ")
    .trim();
}

export type QuoteCheck = { ok: true } | { ok: false; why: "empty" | "too_short" | "not_in_source" };

export function checkQuote(quote: string, sourceText: string): QuoteCheck {
  const q = normalizeForQuote(quote).replace(/^["']|["']$/g, "").trim();
  if (!q) return { ok: false, why: "empty" };
  if (q.split(" ").length < MIN_QUOTE_WORDS) return { ok: false, why: "too_short" };
  return normalizeForQuote(sourceText).includes(q) ? { ok: true } : { ok: false, why: "not_in_source" };
}

/** Returns the label unchanged if the quote checks out, otherwise downgrades it to "irrelevant". */
export function enforceQuote<T extends { label: string; quote: string }>(
  labeled: T,
  sourceText: string,
  context = "",
): T & { quoteCheck: QuoteCheck } {
  if (labeled.label === "irrelevant") return { ...labeled, quoteCheck: { ok: true } };
  const result = checkQuote(labeled.quote, sourceText);
  if (result.ok) return { ...labeled, quoteCheck: result };
  console.warn(`quoteCheck: ${result.why}${context ? ` (${context})` : ""}: "${labeled.quote.slice(0, 120)}"`);
  return { ...labeled, label: "irrelevant", quoteCheck: result };
}
