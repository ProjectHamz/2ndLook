/**
 * Part B-internal types. The shared contract lives in `lib/types.ts` (owned by D);
 * this file only adds the one shape that isn't in it:
 *
 *   ProofCandidate — raw, UNLABELED evidence from Akta/HN/GitHub, before C's model
 *   labels it. Keeps title/summary/fullText so lib/quoteCheck can verify a quote
 *   against the real source text, and `tags` so scoring can set tagMatchesRisk.
 *   A labeled ProofCandidate becomes a ProofPoint from lib/types.ts.
 *
 * prefetch writes DealResult[] (the shared contract), not a Part B shape, because
 * lib/deals.ts reads data/fixtures/deals.json as DealResult[].
 */
export type { RiskCode, ProofSource, ProofLabel, ProofPoint } from "./types";
import type { ProofSource } from "./types";

/** Raw evidence from Akta/HN/GitHub before labeling. */
export type ProofCandidate = {
  source: ProofSource;
  sourceName: string;
  url: string;
  /** YYYY-MM-DD */
  publishedDate: string;
  title: string;
  summary: string;
  fullText: string;
  /** True when Akta reported this company as the item's primary company. */
  primaryCompany: boolean;
  /** Akta signal/event tags, lowercased. Empty for HN/GitHub. */
  tags: string[];
};
