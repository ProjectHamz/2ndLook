/** One row of a fund's pass log. Same shape whether it came from Affinity or a CSV. */
export type PassLogRow = {
  company_name: string;
  /** Normalized: lowercase, no protocol, no "www.", no path. May be "" if unknown. */
  domain: string;
  /** YYYY-MM-DD */
  pass_date: string;
  partner: string;
  stage_at_pass: string;
  sector: string;
  pass_reason_text: string;
  fund_id: string;
  source: "affinity" | "csv";
  /** e.g. the Affinity list entry id, so we can link back. */
  source_ref?: string;
  /** True when no pass date was recorded and we fell back to the date the company was added to the list. */
  pass_date_estimated?: boolean;
};

export type SkippedRow = { company_name: string; why: string };

export const PASS_LOG_COLUMNS = [
  "company_name",
  "domain",
  "pass_date",
  "partner",
  "stage_at_pass",
  "sector",
  "pass_reason_text",
  "fund_id",
] as const;
