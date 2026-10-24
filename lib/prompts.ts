/**
 * Member C's entry point: everything other lanes call into the AI pipeline through here.
 * Prompt text and logic live in lib/ai/*. Every call is traced to PRISM via lib/nicrron.ts.
 *
 *   B: scripts/prefetch.ts loads labelDealProofPoints; lib/comps.ts takes labelForComps + describeComp.
 */
import type { PrefetchedDeal, ProofCandidate } from "./partb-types";
import type { PassRisk, ProofPoint, RiskCode } from "./types";
import { parsePassRisks } from "./ai/passRisks";
import { inBatches, labelProofPoint, tagMatchesRisk } from "./ai/labeler";

export { parsePassRisks, RISK_GUIDE } from "./ai/passRisks";
export { labelProofPoint, tagMatchesRisk } from "./ai/labeler";

/** Newest candidates labeled per deal; keeps prefetch to a few minutes for 30 deals. */
const MAX_CANDIDATES_PER_DEAL = 12;
const BATCH_SIZE = 10;

/**
 * Prefetch hook: parses the deal's pass risks (Prompt 1), then labels each candidate
 * after the pass date against each risk (Prompt 2, labeler-v2 with the quote check).
 * Also sets deal.passRisks and deal.likedTraits so the fixture carries them.
 * Returns only supports/contradicts proof points; strength is left to lib/scoring.ts.
 */
export async function labelDealProofPoints(
  deal: PrefetchedDeal & { passRisks?: PassRisk[]; likedTraits?: string[] },
): Promise<ProofPoint[]> {
  const sessionId = `deal-${deal.dealId}`;
  const parsed = await parsePassRisks(deal.passReasonText, sessionId);
  if (!parsed) throw new Error("pass risks need review");
  deal.passRisks = parsed.passRisks;
  deal.likedTraits = parsed.likedTraits;

  // MARKET_SIZE is always a partner call, so there is nothing for the model to label.
  const risks = parsed.passRisks.filter((r) => r.riskCode !== "MARKET_SIZE");
  const candidates = deal.proofCandidates.filter((c) => c.publishedDate >= deal.passDate).slice(0, MAX_CANDIDATES_PER_DEAL);
  const pairs = risks.flatMap((r) => candidates.map((c) => ({ risk: r.riskCode, c })));

  const labels = await inBatches(pairs, BATCH_SIZE, ({ risk, c }) =>
    labelProofPoint(risk, c, { version: "v2", passDate: deal.passDate, companyName: deal.companyName, sessionId }),
  );

  return pairs.flatMap(({ risk, c }, i) => {
    const l = labels[i]!;
    if (l.label === "irrelevant") return [];
    return [toProofPoint(deal.dealId, i, risk, c, l.label, l.quote)];
  });
}

function toProofPoint(dealId: string, i: number, riskCode: RiskCode, c: ProofCandidate, label: ProofPoint["label"], quote: string): ProofPoint {
  return {
    proofId: `${dealId}-${i}`,
    source: c.source,
    sourceName: c.sourceName,
    url: c.url,
    publishedDate: c.publishedDate,
    quote,
    riskCode,
    label,
    strength: 0,
    primaryCompany: c.primaryCompany,
    tagMatchesRisk: tagMatchesRisk(c.tags, riskCode),
  };
}

/** lib/comps.ts LabelFn: label one comp candidate against the risk it should have cleared. */
export async function labelForComps(riskCode: RiskCode, candidate: ProofCandidate) {
  return labelProofPoint(riskCode, candidate, {
    version: "v2",
    passDate: "0000-00-00",
    companyName: candidate.sourceName,
    sessionId: `comp-${candidate.url}`,
  });
}
