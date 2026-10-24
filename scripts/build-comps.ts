/**
 * Comps from the saved prefetch (option a: Akta's list generation needs credits we no longer have).
 *
 *   npx tsx scripts/build-comps.ts
 *
 * For each passed deal with a risk still open, find other ledger companies in a close sector
 * that already cleared that same risk, using their verified "supports" proof points (labeler-v2,
 * quote-checked). No new model or Akta calls. Caveat for the UI: these comps are also in the
 * pass ledger, so they are "already cleared it", not "never met".
 *
 * Writes data/fixtures/comps.json: [{ compOfDealId, targetRisk, comp }] where comp is the comp's
 * PrefetchedDeal with proofPoints narrowed to the cleared risk. D's converter turns these into
 * DealResult with view "comp".
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { PrefetchedDeal } from "../lib/partb-types";
import type { PassRisk, RiskCode } from "../lib/types";

type Deal = PrefetchedDeal & { passRisks?: PassRisk[]; likedTraits?: string[] };

const KEEP = 12;
/** So the Comps list isn't one company over and over. */
const MAX_PER_COMP = 2;
const FIXTURES = path.join(process.cwd(), "data", "fixtures");

/** Sector buckets for the ledger's sectors; neighboring buckets count as close. */
const BUCKET: Record<string, string> = {
  "fintech infrastructure": "fintech",
  "ai search for finance": "fintech",
  "ai infrastructure": "ai-infra",
  "ml infrastructure": "ai-infra",
  "developer tools": "devtools",
  "ai developer tools": "devtools",
  "gtm data tooling": "devtools",
  "ai customer support": "support",
};
const NEIGHBORS = new Set(["ai-infra|devtools", "devtools|ai-infra", "devtools|support", "support|devtools", "ai-infra|support", "support|ai-infra"]);

function closeness(a: string, b: string): number {
  if (a.toLowerCase() === b.toLowerCase()) return 3;
  const ba = BUCKET[a.toLowerCase()];
  const bb = BUCKET[b.toLowerCase()];
  if (ba && ba === bb) return 2;
  if (ba && bb && NEIGHBORS.has(`${ba}|${bb}`)) return 1;
  return 0;
}

const deals = JSON.parse(readFileSync(path.join(FIXTURES, "prefetched.json"), "utf8")) as Deal[];

const cleared = (d: Deal, risk: RiskCode) => d.proofPoints.filter((p) => p.riskCode === risk && p.label === "supports");

const candidates = deals.flatMap((seed) =>
  (seed.passRisks ?? [])
    .filter((r) => r.riskCode !== "MARKET_SIZE" && cleared(seed, r.riskCode).length === 0)
    .flatMap((r) =>
      deals
        .filter((c) => c.dealId !== seed.dealId && cleared(c, r.riskCode).length > 0)
        .map((c) => {
          const proofs = cleared(c, r.riskCode);
          const sector = closeness(seed.sector, c.sector);
          return { seed, risk: r.riskCode, comp: c, proofs, sector, score: sector * 10 + proofs.length + proofs.filter((p) => p.tagMatchesRisk).length };
        })
        .filter((x) => x.sector > 0),
    ),
);

// Best comp per (seed, risk) first, then fill to KEEP, never the same pair twice.
candidates.sort((a, b) => b.score - a.score);
const picked: typeof candidates = [];
const seedRisk = new Set<string>();
const perComp = new Map<string, number>();
for (const pass of [0, 1]) {
  for (const c of candidates) {
    if (picked.length >= KEEP) break;
    const key = `${c.seed.dealId}|${c.risk}`;
    if (picked.includes(c) || (pass === 0 && seedRisk.has(key)) || (perComp.get(c.comp.dealId) ?? 0) >= MAX_PER_COMP) continue;
    seedRisk.add(key);
    perComp.set(c.comp.dealId, (perComp.get(c.comp.dealId) ?? 0) + 1);
    picked.push(c);
  }
}

const out = picked.map((c) => ({
  compOfDealId: c.seed.dealId,
  targetRisk: c.risk,
  comp: { ...c.comp, proofPoints: c.proofs },
}));
writeFileSync(path.join(FIXTURES, "comps.json"), JSON.stringify(out, null, 2), "utf8");
for (const c of picked) console.log(`${c.comp.companyName.padEnd(14)} comp to ${c.seed.companyName.padEnd(14)} ${c.risk.padEnd(24)} ${c.proofs.length} proof point(s)`);
console.log(`\nwrote ${out.length} comps -> data/fixtures/comps.json`);
