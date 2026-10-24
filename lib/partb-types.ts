/**
 * Part B-internal types. The shared contract now lives in `lib/types.ts` (owned
 * by D), so this file re-exports the shared enums/ProofPoint and only adds the two
 * shapes Part B needs that aren't in the contract:
 *
 *   - ProofCandidate: raw, UNLABELED evidence from Akta/HN/GitHub, before C's
 *     model labels it. Keeps title/summary/fullText so quoteCheck can run against
 *     the real source text. A labeled ProofCandidate becomes a ProofPoint.
 *   - PrefetchedDeal: what scripts/prefetch.ts writes to data/fixtures/deals.json.
 *
 * If D wants these in the shared contract, move them into lib/types.ts and delete
 * this file.
 */
export type { RiskCode, ProofSource, ProofLabel, ProofPoint } from "./types";
import type { ProofSource, ProofPoint } from "./types";

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
  /** Akta news tags, lowercased. C's labeler maps them to tagMatchesRisk for scoring. */
  tags?: string[];
};

/** One deal as assembled by scripts/prefetch.ts. */
export type PrefetchedDeal = {
  dealId: string;
  companyName: string;
  domain: string;
  passDate: string;
  partnerName: string;
  stageAtPass: string;
  sector: string;
  passReasonText: string;
  fundId: string;
  /** Akta company UUID, when resolved. */
  aktaCompanyId: string | null;
  /** All evidence gathered, newest first. */
  proofCandidates: ProofCandidate[];
  /** Filled once C's labeler and D's scoring run; empty otherwise. */
  proofPoints: ProofPoint[];
  /** Per-source notes, e.g. an Akta 403/429 reason, so the UI can say "No coverage". */
  coverage: { akta: string | null; hackerNews: string | null; github: string | null };
};
