/**
 * Deterministic verdict + score rules (PRD "Scoring and verdict logic").
 * The AI only labels and quotes evidence; these pure functions decide.
 * Weights are starting assumptions, not validated. The UI always shows the breakdown.
 */
import type { Company, EvidenceItem, FundThesis, ObjectionCode, Verdict } from "./types";

export function evidenceStrength(e: EvidenceItem, passDate: string): number {
  if (e.published_date <= passDate) return 0;
  if (e.primary_company_match && e.tag_maps_to_objection) return 1;
  return 0.6;
}

export type ObjectionResult = {
  code: ObjectionCode;
  verdict: Verdict;
  evidence: EvidenceItem[];
};

export function objectionVerdict(company: Company, code: ObjectionCode): ObjectionResult {
  const relevant = company.evidence
    .filter((e) => e.objection_code === code && evidenceStrength(e, company.pass_date) > 0)
    .sort((a, b) => b.published_date.localeCompare(a.published_date));
  const used = relevant.filter((e) => e.llm_label !== "irrelevant");

  if (company.evidence.length === 0) return { code, verdict: "INSUFFICIENT_DATA", evidence: [] };
  if (code === "MARKET_SIZE") return { code, verdict: "JUDGMENT_CALL", evidence: used };

  const supports = used.filter((e) => e.llm_label === "supports");
  const strong = supports.filter((e) => evidenceStrength(e, company.pass_date) === 1);
  const newestStrong = strong[0];
  const newerContradiction =
    newestStrong && used.some((e) => e.llm_label === "contradicts" && e.published_date > newestStrong.published_date);

  if (newestStrong && !newerContradiction) return { code, verdict: "RESOLVED", evidence: used };
  if (supports.length > 0) return { code, verdict: "PARTIAL", evidence: used };
  return { code, verdict: "NOT_YET", evidence: used };
}

const VERDICT_POINTS: Record<Verdict, number> = {
  RESOLVED: 1,
  PARTIAL: 0.5,
  NOT_YET: 0,
  INSUFFICIENT_DATA: 0,
  JUDGMENT_CALL: 0,
};

export function thesisFit(c: Company, t: FundThesis): number {
  const has = (list: string[], v: string) => list.some((x) => v.toLowerCase().includes(x.toLowerCase()));
  const text = `${c.sector} ${c.pass_reason_text} ${c.evidence.map((e) => e.title).join(" ")}`;
  let fit = 0;
  if (has(t.sectors, c.sector)) fit += 0.4;
  if (t.stages.some((s) => s.toLowerCase() === c.stage_at_pass.toLowerCase())) fit += 0.3;
  if (t.keywords.some((k) => text.toLowerCase().includes(k.toLowerCase()))) fit += 0.2;
  // Geography isn't tracked yet (0.1 of the PRD weight); left at 0.
  return Math.min(fit, 1);
}

export function momentum(c: Company, today: string): number {
  const now = Date.parse(today);
  let m = 0;
  for (const e of c.evidence) {
    if (e.sentiment !== "positive" || e.published_date <= c.pass_date) continue;
    const ageMonths = Math.max(0, (now - Date.parse(e.published_date)) / (30.44 * 86400000));
    m += 0.4 * Math.exp(-ageMonths / 12);
  }
  return Math.min(m, 1);
}

export type CompanyResult = {
  company: Company;
  objections: ObjectionResult[];
  resolution: number;
  thesisFit: number;
  momentum: number;
  /** 0 to 100 */
  score: number;
  /** The headline verdict for the row. */
  overall: Verdict;
  stageDrift: boolean;
  latestEvidenceDate: string | null;
};

const OVERALL_ORDER: Verdict[] = ["RESOLVED", "PARTIAL", "JUDGMENT_CALL", "NOT_YET", "INSUFFICIENT_DATA"];

export function evaluate(c: Company, thesis: FundThesis, today: string): CompanyResult {
  const objections = c.objections.map((code) => objectionVerdict(c, code));
  const resolution =
    objections.length === 0 ? 0 : objections.reduce((s, o) => s + VERDICT_POINTS[o.verdict], 0) / objections.length;
  const fit = thesisFit(c, thesis);
  const mom = momentum(c, today);
  const score = Math.round(100 * (0.5 * resolution + 0.3 * fit + 0.2 * mom));
  const overall = OVERALL_ORDER.find((v) => objections.some((o) => o.verdict === v)) ?? "NOT_YET";
  const stageDrift = c.evidence.some(
    (e) => e.published_date > c.pass_date && (e.amount_usd ?? 0) > thesis.max_round_size_usd,
  );
  const dates = c.evidence.filter((e) => e.published_date > c.pass_date).map((e) => e.published_date).sort();
  return {
    company: c,
    objections,
    resolution,
    thesisFit: fit,
    momentum: mom,
    score,
    overall,
    stageDrift,
    latestEvidenceDate: dates.at(-1) ?? null,
  };
}

export function rank(companies: Company[], thesis: FundThesis, today: string): CompanyResult[] {
  return companies
    .map((c) => evaluate(c, thesis, today))
    .sort((a, b) => b.resolution - a.resolution || b.score - a.score);
}
