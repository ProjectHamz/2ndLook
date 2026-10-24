/**
 * Comps pipeline — Part B (with C).
 *
 * Finds new companies similar to a passed deal that have ALREADY cleared the risk
 * the fund passed on. B owns the Akta orchestration; C owns the two model steps,
 * which are injected so this module runs and tests without C's code present:
 *
 *   - `describe`  (C Prompt 3): deal traits + target risk  -> one plain-English line
 *   - `label`     (C Prompt 2): risk + candidate proof      -> supports/contradicts/irrelevant
 *
 * Steps (from the build plan):
 *   1. C writes a description for the 3-5 passed deals with the clearest risks.
 *   2. describeTarget -> findCompanies (<=20).
 *   3. Drop companies already in the pass ledger or the Affinity pipeline.
 *   4. Proof-check each candidate against the target risk; keep De-risked/Partial.
 *   5. Keep the best 12, each tagged with compOfDealId.
 */
import { describeTarget, findCompanies, getNewsSince, getCompanySections, type AktaCompany } from "./akta";
import { hackerNewsSince } from "./signals";
import type { ProofCandidate, ProofLabel, RiskCode } from "./partb-types";

export type CompSeed = {
  dealId: string;
  companyName: string;
  domain: string;
  passDate: string;
  sector: string;
  stageAtPass: string;
  likedTraits: string[];
  /** The single risk we want a comp to have already cleared. */
  targetRisk: RiskCode;
};

export type CompCandidate = {
  compOfDealId: string;
  targetRisk: RiskCode;
  company: AktaCompany;
  proofCandidates: ProofCandidate[];
  /** supporting proof count after labeling; drives ranking + the De-risked/Partial keep. */
  supportCount: number;
};

/** C's Prompt 3: traits + risk -> one Filter Builder sentence. */
export type DescribeFn = (seed: CompSeed) => Promise<string>;
/** C's Prompt 2: risk + one candidate -> a label (+ verbatim quote, ignored here). */
export type LabelFn = (riskCode: RiskCode, candidate: ProofCandidate) => Promise<{ label: ProofLabel }>;

export type CompsPipelineOptions = {
  describe: DescribeFn;
  label: LabelFn;
  /** Company names/domains already in the ledger or pipeline, to exclude. */
  exclude: Set<string>;
  /** Default 12. */
  keep?: number;
};

export async function buildComps(seeds: CompSeed[], opts: CompsPipelineOptions): Promise<CompCandidate[]> {
  const keep = opts.keep ?? 12;
  const found: CompCandidate[] = [];
  const seen = new Set<string>([...opts.exclude].map(norm));

  for (const seed of seeds) {
    // 1 + 2: describe the target, then generate a list.
    const describeText = await opts.describe(seed);
    const filters = await describeTarget(describeText);
    if (filters.reason) continue;
    const companies = await findCompanies(filters.data);
    if (companies.reason) continue;

    for (const company of companies.data) {
      // 3: dedupe against ledger/pipeline and earlier comps.
      const key = norm(company.domain || company.name);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      if (!company.domain) continue;

      // 4: gather evidence and proof-check against the single target risk.
      const candidates = await gatherEvidence(company, seed.passDate);
      let supportCount = 0;
      for (const c of candidates) {
        const { label } = await opts.label(seed.targetRisk, c);
        if (label === "supports") supportCount++;
      }
      if (supportCount === 0) continue; // keep only De-risked/Partial comps

      found.push({ compOfDealId: seed.dealId, targetRisk: seed.targetRisk, company, proofCandidates: candidates, supportCount });
    }
  }

  // 5: best first (most supporting proof), capped.
  found.sort((a, b) => b.supportCount - a.supportCount);
  return found.slice(0, keep);
}

/** Pull news + sections + HN for one comp candidate since the seed's pass date. */
async function gatherEvidence(company: AktaCompany, sinceDate: string): Promise<ProofCandidate[]> {
  const out: ProofCandidate[] = [];

  // Akta's news endpoint keys off its company id, not the domain.
  const news = company.id ? await getNewsSince(company.id, sinceDate) : ({ data: null, reason: "empty" } as const);
  if (!news.reason) {
    for (const n of news.data) {
      out.push({
        source: "akta_news",
        sourceName: n.publisher || "Akta news",
        url: n.url,
        publishedDate: n.publishedDate,
        title: n.title,
        summary: n.summary,
        fullText: n.fullText,
        primaryCompany: n.primaryCompany,
        tags: n.tags,
      });
    }
  }

  const sections = await getCompanySections(company.domain!);
  if (!sections.reason) {
    for (const s of sections.data) {
      out.push({
        source: "akta_company",
        sourceName: `Akta: ${s.section}`,
        url: s.url,
        publishedDate: s.asOf,
        title: s.section,
        summary: s.text.slice(0, 200),
        fullText: s.text,
        primaryCompany: true,
        tags: [s.section.replace(/_/g, " ")],
      });
    }
  }

  out.push(...(await hackerNewsSince(company.name, sinceDate)));

  // newest first
  return out.sort((a, b) => (a.publishedDate < b.publishedDate ? 1 : -1));
}

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/^www\./, "");
}
