/** The shape the UI reads. Lane A (Akta/EDGAR) and lane B (AI labeling) produce this. */

export type ObjectionCode =
  | "PRE_PRODUCT"
  | "NO_ENTERPRISE_CUSTOMERS"
  | "TOO_EARLY_REVENUE"
  | "TEAM_GAP"
  | "GTM_UNPROVEN"
  | "MARKET_SIZE"
  | "ROUND_DYNAMICS";

export const OBJECTION_LABEL: Record<ObjectionCode, string> = {
  PRE_PRODUCT: "No product yet",
  NO_ENTERPRISE_CUSTOMERS: "No big customers",
  TOO_EARLY_REVENUE: "Too early on revenue",
  TEAM_GAP: "Team gap",
  GTM_UNPROVEN: "No distribution yet",
  MARKET_SIZE: "Market too small",
  ROUND_DYNAMICS: "Round dynamics",
};

/** What evidence resolves each objection, in plain words (shown on the brief). */
export const OBJECTION_PROOF: Record<ObjectionCode, string> = {
  PRE_PRODUCT: "A product launch after the pass date",
  NO_ENTERPRISE_CUSTOMERS: "A partnership or a named enterprise customer",
  TOO_EARLY_REVENUE: "A new equity raise (news or Form D)",
  TEAM_GAP: "A CTO or VP Engineering hire",
  GTM_UNPROVEN: "Partnerships, channel deals or launch coverage",
  MARKET_SIZE: "Expansion news, reviewed by a person",
  ROUND_DYNAMICS: "A new round announced",
};

export type Verdict = "RESOLVED" | "PARTIAL" | "NOT_YET" | "INSUFFICIENT_DATA" | "JUDGMENT_CALL";

export const VERDICT_LABEL: Record<Verdict, string> = {
  RESOLVED: "De-risked",
  PARTIAL: "Partially de-risked",
  NOT_YET: "Open",
  INSUFFICIENT_DATA: "No coverage",
  JUDGMENT_CALL: "Partner call",
};

export type EvidenceSource = "akta_news" | "akta_company" | "edgar" | "hacker_news";

export const SOURCE_LABEL: Record<EvidenceSource, string> = {
  akta_news: "Akta news",
  akta_company: "Akta company profile",
  edgar: "SEC EDGAR Form D",
  hacker_news: "Hacker News",
};

export type EvidenceItem = {
  id: string;
  source: EvidenceSource;
  url: string;
  /** YYYY-MM-DD */
  published_date: string;
  title: string;
  /** Verbatim quote from the source. Required for "supports". */
  quote: string;
  objection_code: ObjectionCode;
  llm_label: "supports" | "contradicts" | "irrelevant";
  /** Akta says this company is the main subject (not a passing mention). */
  primary_company_match: boolean;
  /** The Akta event type maps to this objection (vs. the AI alone deciding). */
  tag_maps_to_objection: boolean;
  sentiment: "positive" | "neutral" | "negative";
  /** For funding events, used for the stage-drift flag. */
  amount_usd?: number;
};

export type Company = {
  id: string;
  name: string;
  domain: string;
  sector: string;
  stage_at_pass: string;
  /** YYYY-MM-DD */
  pass_date: string;
  partner: string;
  founder_name: string;
  pass_reason_text: string;
  objections: ObjectionCode[];
  evidence: EvidenceItem[];
  open_questions: string[];
};

export type FundThesis = {
  id: string;
  name: string;
  sectors: string[];
  stages: string[];
  keywords: string[];
  max_round_size_usd: number;
};
