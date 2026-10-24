/**
 * Conviction scoring. Pure functions only: no I/O, no model calls.
 * The model labels proof points (supports / contradicts / irrelevant); these rules alone decide
 * every risk status and score. Rules are from "2ndLook Build Plan.md", Member D.
 */
import type {
  CompanyProfile,
  Conviction,
  FundingRound,
  PassLogRow,
  PassRisk,
  ProofPoint,
  RiskAssessment,
  RiskCode,
  RiskStatus,
  Thesis,
} from "./types";

export const STRONG = 1.0;
export const WEAK = 0.6;

/** Sum of supporting strength that counts as full traction (three strong proof points). */
const FULL_TRACTION = 3;

/**
 * 0 if published before the pass date (dates are YYYY-MM-DD, so string order is date order).
 * 1.0 for Akta with the company as primary_company and a news tag that matches the risk.
 * 0.6 otherwise (mention-only, social, or founder-submitted).
 */
export function proofStrength(p: ProofPoint, passDate: string): number {
  if (p.publishedDate < passDate) return 0;
  const akta = p.source === "akta_news" || p.source === "akta_company";
  return akta && p.primaryCompany && p.tagMatchesRisk ? STRONG : WEAK;
}

/** Returns copies of the proof points with `strength` set for this pass date. */
export function withStrength(proofs: ProofPoint[], passDate: string): ProofPoint[] {
  return proofs.map((p) => ({ ...p, strength: proofStrength(p, passDate) }));
}

/**
 * Status of one pass risk, from proof points whose `strength` is already set.
 * - MARKET_SIZE is always a Partner call.
 * - No proof points after the pass: No coverage.
 * - A strong "supports" with no newer "contradicts": De-risked.
 * - Any other "supports" (weak, or strong but contradicted later): Partially de-risked.
 * - Otherwise: Open.
 */
export function assessRisk(riskCode: RiskCode, proofs: ProofPoint[]): RiskAssessment {
  const counted = proofs.filter((p) => p.riskCode === riskCode && p.strength > 0);
  const supports = counted.filter((p) => p.label === "supports");
  const contradicts = counted.filter((p) => p.label === "contradicts");
  const proofIds = [...supports, ...contradicts]
    .sort((a, b) => b.publishedDate.localeCompare(a.publishedDate))
    .map((p) => p.proofId);

  let status: RiskStatus;
  if (riskCode === "MARKET_SIZE") status = "PARTNER_CALL";
  else if (counted.length === 0) status = "NO_COVERAGE";
  else if (
    supports.some(
      (s) => s.strength >= STRONG && !contradicts.some((c) => c.publishedDate > s.publishedDate),
    )
  )
    status = "DERISKED";
  else if (supports.length > 0) status = "PARTIAL";
  else status = "OPEN";

  return { riskCode, status, proofIds };
}

/** De-risked 1, Partially 0.5, everything else 0, averaged over the deal's pass risks. */
export function deriskingScore(assessments: RiskAssessment[]): number {
  if (assessments.length === 0) return 0;
  const points = assessments.map((a): number => (a.status === "DERISKED" ? 1 : a.status === "PARTIAL" ? 0.5 : 0));
  return points.reduce((s, x) => s + x, 0) / assessments.length;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Whole-word, case-insensitive: "AI" matches "AI search" but not "retail". */
function mentions(text: string, term: string): boolean {
  if (!text || !term) return false;
  return new RegExp(`\\b${escapeRegExp(term)}\\b`, "i").test(text);
}

/**
 * Sector 0.4 + stage 0.3 + keywords 0.2 + geography 0.1. Each part is all or nothing.
 * Keywords and geography need the Akta company profile; without it they score 0.
 */
export function thesisFit(deal: PassLogRow, thesis: Thesis, profile: CompanyProfile = {}): number {
  const about = [deal.sector, profile.description ?? ""].join(" ");
  const sector = thesis.sectors.some((s) => mentions(deal.sector, s) || mentions(s, deal.sector));
  const stage = thesis.stages.some((s) => s.toLowerCase() === deal.stage_at_pass.trim().toLowerCase());
  const keyword = thesis.keywords.some((k) => mentions(about, k));
  const geo = !!profile.geography && thesis.geographies.some((g) => mentions(profile.geography!, g));
  return (sector ? 0.4 : 0) + (stage ? 0.3 : 0) + (keyword ? 0.2 : 0) + (geo ? 0.1 : 0);
}

/** Positive signals since the pass: summed strength of "supports" proof points, capped at 1. */
export function tractionScore(proofs: ProofPoint[]): number {
  const sum = proofs.filter((p) => p.label === "supports").reduce((s, p) => s + p.strength, 0);
  return Math.min(1, sum / FULL_TRACTION);
}

/** A round after the pass date larger than the fund can take a meaningful allocation in. */
export function hasAllocationRisk(rounds: FundingRound[], passDate: string, maxRoundSizeUsd: number): boolean {
  return rounds.some((r) => r.date >= passDate && r.amountUsd > maxRoundSizeUsd);
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function conviction(derisking: number, thesisFitScore: number, traction: number): Conviction {
  return {
    derisking: round2(derisking),
    thesisFit: round2(thesisFitScore),
    traction: round2(traction),
    total: round2(derisking * 0.5 + thesisFitScore * 0.3 + traction * 0.2),
  };
}

export type ScoreInput = {
  deal: PassLogRow;
  companyProfile?: CompanyProfile;
  passRisks: PassRisk[];
  proofPoints: ProofPoint[];
  rounds?: FundingRound[];
};

export type ScoreOutput = {
  proofPoints: ProofPoint[];
  assessments: RiskAssessment[];
  conviction: Conviction;
  allocationRisk: boolean;
};

/** Everything scoring adds to a DealResult. Used by prefetch, "Check again" and founder proofs. */
export function scoreDeal(input: ScoreInput, thesis: Thesis): ScoreOutput {
  const proofPoints = withStrength(input.proofPoints, input.deal.pass_date);
  const assessments = input.passRisks.map((r) => assessRisk(r.riskCode, proofPoints));
  return {
    proofPoints,
    assessments,
    conviction: conviction(deriskingScore(assessments), thesisFit(input.deal, thesis, input.companyProfile), tractionScore(proofPoints)),
    allocationRisk: hasAllocationRisk(input.rounds ?? [], input.deal.pass_date, thesis.maxRoundSizeUsd),
  };
}

/** Highest conviction first; ties broken by company name so the list is stable. */
export function rankByConviction<T extends { conviction: Conviction; deal: PassLogRow }>(results: T[]): T[] {
  return [...results].sort(
    (a, b) => b.conviction.total - a.conviction.total || a.deal.company_name.localeCompare(b.deal.company_name),
  );
}
