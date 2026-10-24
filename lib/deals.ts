/**
 * Reads deal results for the API routes. SERVER ONLY.
 * Source: data/fixtures/deals.json (B's frozen prefetch) if present, else data/mock-deals.json.
 * Every read merges in Supabase rows (deal leads, founder proofs, Affinity syncs) and re-scores,
 * so a founder's proof changes the risk status without a re-prefetch.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { rankByConviction, scoreDeal } from "./scoring";
import { listAffinitySyncs, listDealLeads, listFounderProofs } from "./store";
import type { DealResult, DealView, FounderProofRow, ProofPoint, Thesis } from "./types";

const DATA = path.join(process.cwd(), "data");

async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(path.join(DATA, file), "utf8")) as T;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
}

export async function loadThesis(): Promise<Thesis> {
  const thesis = await readJson<Thesis>("thesis.json");
  if (!thesis) throw new Error("data/thesis.json is missing");
  return thesis;
}

/** Raw results as prefetched, before Supabase rows are merged in. */
export async function loadDealResults(): Promise<DealResult[]> {
  return (await readJson<DealResult[]>("fixtures/deals.json")) ?? (await readJson<DealResult[]>("mock-deals.json")) ?? [];
}

/** A founder-submitted proof becomes a proof point on the risk whose milestone it answers. */
function founderProofPoints(r: DealResult, proofs: FounderProofRow[]): ProofPoint[] {
  return proofs
    .filter((f) => f.token === r.trackerToken)
    .flatMap((f, i) => {
      const risk = r.passRisks.find((p) => p.founderMilestone === f.milestone);
      if (!risk) return [];
      return [
        {
          proofId: `founder-${r.deal.dealId}-${i}`,
          source: "founder" as const,
          sourceName: "Sent by the founder",
          url: f.url,
          publishedDate: f.created_at.slice(0, 10),
          quote: f.quote,
          riskCode: risk.riskCode,
          label: f.label,
          strength: 0,
        },
      ];
    });
}

async function withLiveRows(results: DealResult[]): Promise<DealResult[]> {
  const [thesis, leads, proofs, syncs] = await Promise.all([
    loadThesis(),
    listDealLeads(),
    listFounderProofs(),
    listAffinitySyncs(),
  ]);
  const leadById = new Map(leads.map((l) => [l.deal_id, l]));
  const synced = new Set(syncs.map((s) => s.deal_id));

  return results.map((r) => {
    const fromFounder = founderProofPoints(r, proofs);
    const scored = scoreDeal(
      { deal: r.deal, passRisks: r.passRisks, proofPoints: [...r.proofPoints, ...fromFounder], rounds: r.fundingRounds },
      thesis,
    );
    const lead = leadById.get(r.deal.dealId);
    return {
      ...r,
      ...scored,
      // Keep the prefetched flag when we have no rounds to recompute it from.
      allocationRisk: r.fundingRounds ? scored.allocationRisk : r.allocationRisk,
      dealLead: lead?.deal_lead ?? r.dealLead,
      followUpDate: lead?.follow_up_date ?? r.followUpDate,
      affinitySynced: r.affinitySynced || synced.has(r.deal.dealId),
      founderSentProof: fromFounder.length > 0,
    };
  });
}

/** Ranked results for one view, highest conviction first. */
export async function getDeals(view: DealView): Promise<DealResult[]> {
  const all = await loadDealResults();
  return rankByConviction(await withLiveRows(all.filter((r) => r.view === view)));
}

export async function getDeal(dealId: string): Promise<DealResult | null> {
  const r = (await loadDealResults()).find((x) => x.deal.dealId === dealId);
  return r ? (await withLiveRows([r]))[0]! : null;
}

export async function getDealByToken(token: string): Promise<DealResult | null> {
  const r = (await loadDealResults()).find((x) => x.trackerToken === token);
  return r ? (await withLiveRows([r]))[0]! : null;
}
