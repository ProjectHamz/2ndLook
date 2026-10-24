/**
 * TEMPORARY Part B types.
 *
 * The shared data contract (PassedDeal / PassRisk / ProofPoint / RiskAssessment /
 * DealResult) is owned by D in `lib/types.ts`, which is not committed yet. To let
 * Part B (Akta client, signals, comps, prefetch) compile and run standalone, the
 * minimal shapes Part B produces live here.
 *
 * WHEN D COMMITS `lib/types.ts`: delete the duplicated shapes below and
 * `import type { ProofPoint, RiskCode, ... } from "./types"` instead. The field
 * names here follow the updated build plan (camelCase) so that swap is mechanical.
 *
 * The pass ledger itself stays snake_case (`PassLogRow` in lib/passlog/types.ts) —
 * that is the agreed CSV contract and is not changed here.
 */

export type RiskCode =
  | "PRE_PRODUCT"
  | "NO_ENTERPRISE_CUSTOMERS"
  | "TOO_EARLY_REVENUE"
  | "TEAM_GAP"
  | "GTM_UNPROVEN"
  | "MARKET_SIZE"
  | "ROUND_DYNAMICS";

export type ProofSource = "akta_news" | "akta_company" | "hacker_news" | "github" | "founder";

export type ProofLabel = "supports" | "contradicts" | "irrelevant";

/**
 * A raw, unlabeled piece of evidence as produced by Part B (Akta/HN/GitHub),
 * before C's model labels it. `fullText` is kept so the quote check can run
 * against the real source text.
 */
export type ProofCandidate = {
  source: ProofSource;
  sourceName: string;
  url: string;
  /** YYYY-MM-DD */
  publishedDate: string;
  title: string;
  summary: string;
  fullText: string;
  /** True when Akta reported this company as the primary company of the item. */
  primaryCompany: boolean;
};

/** A labeled proof point (Part B candidate + C's label/quote + D's strength). */
export type ProofPoint = ProofCandidate & {
  proofId: string;
  riskCode: RiskCode;
  label: ProofLabel;
  /** Verbatim quote from the source; must pass lib/quoteCheck against fullText. */
  quote: string;
  /** 0, 0.6 or 1.0. Set by D's scoring; Part B leaves it at -1 ("unscored"). */
  strength: number;
};

/** What `scripts/prefetch.ts` writes per deal into data/fixtures/deals.json. */
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
  /** All evidence gathered for this deal, newest first. Labels may be unset until C runs. */
  proofCandidates: ProofCandidate[];
  /** Populated once C's labeler and D's scoring run; empty otherwise. */
  proofPoints: ProofPoint[];
  /** Per-source notes, e.g. an Akta 403/429 reason, so the UI can say "No coverage". */
  coverage: { akta: string | null; hackerNews: string | null; github: string | null };
};
