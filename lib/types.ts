/**
 * Shared contract for 2ndLook. Owned by Member D: tell the group before changing anything here.
 * Words match the glossary in "2ndLook Build Plan.md" (pass ledger, pass risk, proof point, ...).
 */

export type RiskCode =
  | "PRE_PRODUCT"
  | "NO_ENTERPRISE_CUSTOMERS"
  | "TOO_EARLY_REVENUE"
  | "TEAM_GAP"
  | "GTM_UNPROVEN"
  | "MARKET_SIZE"
  | "ROUND_DYNAMICS";

export type RiskStatus = "DERISKED" | "PARTIAL" | "OPEN" | "NO_COVERAGE" | "PARTNER_CALL";

/** One row of the pass ledger. */
export type PassedDeal = {
  dealId: string;
  affinityEntryId?: number;
  companyName: string;
  domain: string;
  /** YYYY-MM-DD */
  passDate: string;
  partnerName: string;
  stageAtPass: string;
  sector: string;
  passReasonText: string;
  /** Optional extras used for thesis fit; filled from Akta when we have them. */
  geography?: string;
  description?: string;
};

/** One specific reason the fund passed, parsed from passReasonText by C's Prompt 1. */
export type PassRisk = {
  riskCode: RiskCode;
  /** The words in the pass note this risk came from. Struck through in the UI once de-risked. */
  sourcePhrase: string;
  /** What the founder would need to show, e.g. "Launch a product customers can use". */
  founderMilestone: string;
};

export type ProofSource = "akta_news" | "akta_company" | "hacker_news" | "github" | "founder";
export type ProofLabel = "supports" | "contradicts" | "irrelevant";

/** One dated, sourced piece of evidence. `label` comes from C's Prompt 2; `strength` from lib/scoring.ts. */
export type ProofPoint = {
  proofId: string;
  source: ProofSource;
  sourceName: string;
  url: string;
  /** YYYY-MM-DD */
  publishedDate: string;
  /** Verbatim quote from the source (checked by lib/quoteCheck.ts). */
  quote: string;
  riskCode: RiskCode;
  label: ProofLabel;
  strength: number;
  /** Akta only: the company is the article's primary_company, not just mentioned. */
  primaryCompany?: boolean;
  /** Akta only: the article's news tag matches this risk (e.g. "Product Launch" for PRE_PRODUCT). */
  tagMatchesRisk?: boolean;
};

export type RiskAssessment = { riskCode: RiskCode; status: RiskStatus; proofIds: string[] };

export type Conviction = { derisking: number; thesisFit: number; traction: number; total: number };

export type DealView = "anti_portfolio" | "comp";

export type DealResult = {
  view: DealView;
  deal: PassedDeal;
  /** For comps: the passed deal this company is a comp of. */
  compOfDealId?: string;
  passRisks: PassRisk[];
  likedTraits: string[];
  proofPoints: ProofPoint[];
  assessments: RiskAssessment[];
  conviction: Conviction;
  allocationRisk: boolean;
  dealLead?: string;
  /** YYYY-MM-DD */
  followUpDate?: string;
  trackerToken: string;
  prismChecked: boolean;
  affinitySynced: boolean;
  /** Set when a founder has sent proof through the milestone tracker. */
  founderSentProof?: boolean;
};

/** A priced round, used for the allocation risk flag. */
export type FundingRound = { date: string; amountUsd: number; roundType?: string };

/** data/thesis.json */
export type Thesis = {
  fundName: string;
  sectors: string[];
  stages: string[];
  keywords: string[];
  geographies: string[];
  maxRoundSizeUsd: number;
};

/** Supabase rows (the only runtime writes). */
export type FounderProofRow = { token: string; milestone: string; url: string; label: ProofLabel; quote: string; created_at: string };
export type DealLeadRow = { deal_id: string; deal_lead: string; follow_up_date: string | null };
export type AffinitySyncRow = { deal_id: string; field: string; value: string; synced_at: string };
