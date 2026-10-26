/**
 * Prefetch — Part B. Run locally (NOT on Vercel; its FS is read-only at runtime):
 *
 *   npx tsx scripts/prefetch.ts            # won't clobber deals.json with unlabeled deals
 *   npx tsx scripts/prefetch.ts --force    # write deals.json even with no proof points
 *
 * For each deal in data/pass-ledger.csv it resolves the company, pulls Akta news
 * since the pass date, Akta company sections, and Hacker News, captures every raw
 * Akta response to data/fixtures/akta/, then writes DealResult[] to
 * data/fixtures/deals.json.
 *
 * OUTPUT SHAPE MATTERS: lib/deals.ts reads data/fixtures/deals.json as
 * DealResult[] and prefers it over data/mock-deals.json. Writing the internal
 * PrefetchedDeal shape there silently blanks the UI, so this script converts to
 * DealResult before writing, and refuses to write at all when a run produced no
 * labeled proof points (it writes deals.partial.json instead).
 *
 * C's labeling (lib/prompts#labelDealProofPoints) is OPTIONAL: it parses the pass
 * risks (Prompt 1) and labels candidates (Prompt 2), setting deal.passRisks and
 * deal.likedTraits. Without it the run still gathers and caches evidence.
 * Scoring uses lib/scoring#scoreDeal; lib/deals.ts re-scores on every read, so
 * these values just make the committed fixture sensible on its own.
 *
 * Schedule (plan): run at 12:30 for all 30, rerun 2:30, FREEZE 2:45 and commit.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

import { rowsFromCsv } from "../lib/passlog/csv";
import type { PassLogRow } from "../lib/passlog/types";
import { dealIdFor } from "../lib/passlog/normalize";
import { resolveCompany, getNewsSince, getCompanySections } from "../lib/akta";
import { hackerNewsSince } from "../lib/signals";
import { scoreDeal } from "../lib/scoring";
import type { ProofCandidate, PrefetchedDeal } from "../lib/partb-types";
import type { DealResult, PassRisk, ProofPoint, Thesis } from "../lib/types";

const ROOT = process.cwd();
const LEDGER = path.join(ROOT, "data", "pass-ledger.csv");
const OUT = path.join(ROOT, "data", "fixtures", "deals.json");
const OUT_PARTIAL = path.join(ROOT, "data", "fixtures", "deals.partial.json");
const OUT_COVERAGE = path.join(ROOT, "data", "fixtures", "coverage.json");

/** What C's labeler fills in on the deal it is handed. */
type LabeledDeal = PrefetchedDeal & { passRisks?: PassRisk[]; likedTraits?: string[] };
type Labeler = (deal: LabeledDeal) => Promise<ProofPoint[]>;

async function main() {
  await loadEnv();
  // Capture every Akta response as a fixture during prefetch.
  process.env.AKTA_CAPTURE = process.env.AKTA_CAPTURE ?? "1";
  const force = process.argv.includes("--force");

  if (!process.env.AKTA_API_KEY) {
    console.warn("[prefetch] AKTA_API_KEY not set — Akta calls will return 'no_api_key' and coverage will be empty.");
    console.warn("[prefetch] Hacker News still runs (no key). Add AKTA_API_KEY to .env.local for real proof points.");
  }

  const thesis = JSON.parse(await fs.readFile(path.join(ROOT, "data", "thesis.json"), "utf8")) as Thesis;
  const csv = await fs.readFile(LEDGER, "utf8");
  const { rows, skipped, errors } = rowsFromCsv(csv, "harbor_street");
  if (errors.length) {
    console.error("[prefetch] ledger errors:", errors.join("; "));
    process.exit(1);
  }
  if (skipped.length) console.warn(`[prefetch] skipped ${skipped.length} row(s):`, skipped.map((s) => s.company_name).join(", "));

  const label = await tryLoadLabeler();
  if (!label) console.warn("[prefetch] lib/prompts#labelDealProofPoints not found — proofPoints will be empty.");

  const results: DealResult[] = [];
  const coverage: Record<string, PrefetchedDeal["coverage"]> = {};
  let totalCandidates = 0;
  let totalProofPoints = 0;

  for (const [i, r] of rows.entries()) {
    process.stdout.write(`[prefetch] (${i + 1}/${rows.length}) ${r.company_name} ... `);
    const deal: LabeledDeal = await prefetchDeal(r);
    totalCandidates += deal.proofCandidates.length;

    if (label) {
      try {
        deal.proofPoints = await label(deal);
      } catch (e) {
        console.warn(`\n[prefetch] labeler failed for ${r.company_name}:`, (e as Error).message);
      }
    }
    totalProofPoints += deal.proofPoints.length;

    coverage[deal.dealId] = deal.coverage;
    results.push(toDealResult(deal, r, thesis));
    console.log(`${deal.proofCandidates.length} candidates, ${deal.proofPoints.length} proof points`);
  }

  await fs.mkdir(path.dirname(OUT), { recursive: true });
  await fs.writeFile(OUT_COVERAGE, JSON.stringify(coverage, null, 2), "utf8");
  const json = JSON.stringify(results, null, 2);

  if (totalProofPoints === 0 && !force) {
    await fs.writeFile(OUT_PARTIAL, json, "utf8");
    console.log(`\n[prefetch] ${results.length} deals, ${totalCandidates} raw candidates, 0 labeled proof points.`);
    console.log(`[prefetch] wrote ${path.relative(ROOT, OUT_PARTIAL)} instead of deals.json, so the UI keeps using data/mock-deals.json.`);
    console.log("[prefetch] re-run with AKTA_API_KEY + lib/prompts available, or pass --force to write deals.json anyway.");
    return;
  }

  await fs.writeFile(OUT, json, "utf8");
  console.log(`\n[prefetch] wrote ${results.length} deals (${totalProofPoints} proof points) -> ${path.relative(ROOT, OUT)}`);
}

/**
 * PrefetchedDeal (Part B internal) -> DealResult (the shape lib/deals.ts reads).
 * `deal` is the original ledger row: DealResult.deal is a PassLogRow.
 */
function toDealResult(deal: LabeledDeal, row: PassLogRow, thesis: Thesis): DealResult {
  const passRisks = deal.passRisks ?? [];
  const scored = scoreDeal({ deal: row, passRisks, proofPoints: deal.proofPoints }, thesis);

  return {
    dealId: deal.dealId,
    view: "anti_portfolio",
    deal: row,
    passRisks,
    likedTraits: deal.likedTraits ?? [],
    proofPoints: scored.proofPoints,
    assessments: scored.assessments,
    conviction: scored.conviction,
    allocationRisk: scored.allocationRisk,
    trackerToken: trackerTokenFor(deal.dealId),
    prismChecked: false,
    affinitySynced: false,
  };
}

/**
 * Stable 12-character tracker token derived from the deal id. Deterministic on
 * purpose: a random token each run would break founder tracker links already
 * shared, and Supabase founder_proofs rows are keyed by token.
 */
function trackerTokenFor(dealId: string): string {
  return createHash("sha256").update(`2ndlook:${dealId}`).digest("base64url").replace(/[-_]/g, "").slice(0, 12);
}

async function prefetchDeal(r: PassLogRow): Promise<PrefetchedDeal> {
  const coverage: PrefetchedDeal["coverage"] = { akta: null, hackerNews: null, github: null };
  const candidates: ProofCandidate[] = [];
  let aktaCompanyId: string | null = null;

  if (r.domain) {
    const company = await resolveCompany(r.domain);
    if (company.reason) coverage.akta = company.reason;
    else aktaCompanyId = company.data.id || null;

    const news = await getNewsSince(r.domain, r.pass_date);
    if (news.reason) coverage.akta = coverage.akta ?? news.reason;
    else
      for (const n of news.data)
        candidates.push({
          source: "akta_news",
          sourceName: n.primaryCompany ? "Akta news" : "Akta news (mention)",
          url: n.url,
          publishedDate: n.publishedDate,
          title: n.title,
          summary: n.summary,
          fullText: n.fullText,
          primaryCompany: n.primaryCompany,
          tags: n.tags,
        });

    const sections = await getCompanySections(r.domain);
    if (!sections.reason)
      for (const s of sections.data)
        candidates.push({
          source: "akta_company",
          sourceName: `Akta: ${s.section}`,
          url: s.url,
          publishedDate: s.asOf,
          title: s.section,
          summary: s.text.slice(0, 200),
          fullText: s.text,
          primaryCompany: true,
        });
  } else {
    coverage.akta = "empty";
  }

  const hn = await hackerNewsSince(r.company_name, r.pass_date);
  coverage.hackerNews = hn.length ? null : "empty";
  candidates.push(...hn);

  candidates.sort((a, b) => (a.publishedDate < b.publishedDate ? 1 : -1)); // newest first

  return {
    dealId: dealIdFor(r),
    companyName: r.company_name,
    domain: r.domain,
    passDate: r.pass_date,
    partnerName: r.partner,
    stageAtPass: r.stage_at_pass,
    sector: r.sector,
    passReasonText: r.pass_reason_text,
    fundId: r.fund_id,
    aktaCompanyId,
    proofCandidates: candidates,
    proofPoints: [],
    coverage,
  };
}

// --- optional C hook (loaded only if present) ---------------------------------
async function tryLoadLabeler(): Promise<Labeler | null> {
  // Non-literal specifier so `tsc --noEmit` passes even if lib/prompts is absent.
  const spec = "../lib/prompts";
  try {
    const mod: any = await import(spec);
    if (typeof mod.labelDealProofPoints === "function") return mod.labelDealProofPoints as Labeler;
  } catch {
    /* module not present */
  }
  return null;
}

// --- tiny .env loader (no dependency) ------------------------------------------
async function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    try {
      const text = await fs.readFile(path.join(ROOT, file), "utf8");
      for (const line of text.split(/\r?\n/)) {
        const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
        if (!m) continue;
        const key = m[1]!;
        let val = m[2]!.trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
        if (process.env[key] === undefined) process.env[key] = val;
      }
    } catch {
      /* no such file */
    }
  }
}

main().catch((e) => {
  console.error("[prefetch] fatal:", e);
  process.exit(1);
});
