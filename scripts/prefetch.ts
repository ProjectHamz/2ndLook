/**
 * Prefetch — Part B. Run locally (NOT on Vercel; its FS is read-only at runtime):
 *
 *   npx tsx scripts/prefetch.ts
 *
 * For each deal in data/pass-ledger.csv it resolves the company, pulls Akta news
 * since the pass date, Akta company sections, and Hacker News, captures every raw
 * Akta response to data/fixtures/akta/, then writes the assembled deals to
 * data/fixtures/deals.json.
 *
 * C's labeling (lib/prompts) and D's scoring (lib/scoring) are OPTIONAL: if those
 * modules exist they are used to fill `proofPoints`; if not, prefetch still runs
 * and emits the raw `proofCandidates` + coverage, so the pipeline is useful before
 * C and D land. Re-run after they merge to produce fully labeled, scored fixtures.
 *
 * Schedule (plan): run at 12:30 for all 30, rerun 2:30, FREEZE 2:45 and commit.
 */
import { promises as fs } from "node:fs";
import path from "node:path";

import { rowsFromCsv } from "../lib/passlog/csv";
import type { PassLogRow } from "../lib/passlog/types";
import { resolveCompany, getNewsSince, getCompanySections } from "../lib/akta";
import { hackerNewsSince } from "../lib/signals";
import type { ProofCandidate, PrefetchedDeal } from "../lib/partb-types";

const ROOT = process.cwd();
const LEDGER = path.join(ROOT, "data", "pass-ledger.csv");
const OUT = path.join(ROOT, "data", "fixtures", "deals.json");

async function main() {
  await loadEnv();
  // Capture every Akta response as a fixture during prefetch.
  process.env.AKTA_CAPTURE = process.env.AKTA_CAPTURE ?? "1";

  if (!process.env.AKTA_API_KEY) {
    console.warn("[prefetch] AKTA_API_KEY not set — Akta calls will return 'no_api_key' and coverage will be empty.");
    console.warn("[prefetch] Hacker News still runs (no key). Add AKTA_API_KEY to .env.local for real proof points.");
  }

  const csv = await fs.readFile(LEDGER, "utf8");
  const { rows, skipped, errors } = rowsFromCsv(csv, "harbor_street");
  if (errors.length) {
    console.error("[prefetch] ledger errors:", errors.join("; "));
    process.exit(1);
  }
  if (skipped.length) console.warn(`[prefetch] skipped ${skipped.length} row(s):`, skipped.map((s) => s.company_name).join(", "));

  const label = await tryLoadLabeler();
  const score = await tryLoadScorer();

  const deals: PrefetchedDeal[] = [];
  for (const [i, r] of rows.entries()) {
    process.stdout.write(`[prefetch] (${i + 1}/${rows.length}) ${r.company_name} ... `);
    const deal = await prefetchDeal(r);

    if (label) {
      try {
        deal.proofPoints = await label(deal);
      } catch (e) {
        console.warn(`\n[prefetch] labeler failed for ${r.company_name}:`, (e as Error).message);
      }
    }
    if (score && deal.proofPoints.length) {
      try {
        await score(deal);
      } catch (e) {
        console.warn(`\n[prefetch] scorer failed for ${r.company_name}:`, (e as Error).message);
      }
    }

    deals.push(deal);
    console.log(`${deal.proofCandidates.length} candidates`);
  }

  await fs.mkdir(path.dirname(OUT), { recursive: true });
  await fs.writeFile(OUT, JSON.stringify(deals, null, 2), "utf8");
  console.log(`\n[prefetch] wrote ${deals.length} deals -> ${path.relative(ROOT, OUT)}`);
  if (!label) console.log("[prefetch] note: lib/prompts labeler not found — proofPoints left empty (candidates captured).");
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
    dealId: slug(r.company_name),
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

// --- optional C/D hooks (loaded only if present) -------------------------------
type Labeler = (deal: PrefetchedDeal) => Promise<PrefetchedDeal["proofPoints"]>;
type Scorer = (deal: PrefetchedDeal) => Promise<void>;

async function tryLoadLabeler(): Promise<Labeler | null> {
  try {
    const mod: any = await import("../lib/prompts");
    if (typeof mod.labelDealProofPoints === "function") return mod.labelDealProofPoints as Labeler;
  } catch {
    /* module not present yet */
  }
  return null;
}

async function tryLoadScorer(): Promise<Scorer | null> {
  try {
    const mod: any = await import("../lib/scoring");
    if (typeof mod.scoreDealInPlace === "function") return mod.scoreDealInPlace as Scorer;
  } catch {
    /* module not present yet */
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

function slug(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

main().catch((e) => {
  console.error("[prefetch] fatal:", e);
  process.exit(1);
});
