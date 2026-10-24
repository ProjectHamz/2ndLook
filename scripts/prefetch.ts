/**
 * Prefetch — Part B. Run locally (NOT on Vercel; its FS is read-only at runtime):
 *
 *   npx tsx scripts/prefetch.ts            # safe: won't clobber deals.json with empty evidence
 *   npx tsx scripts/prefetch.ts --force    # write deals.json even with no proof points
 *
 * For each deal in data/pass-ledger.csv it resolves the company, pulls Akta news
 * since the pass date, Akta company sections and Hacker News, captures every raw
 * Akta response into data/fixtures/akta/, then writes DealResult[] to
 * data/fixtures/deals.json — the shape lib/deals.ts reads.
 *
 * C's model steps are OPTIONAL and loaded from lib/prompts if present:
 *   parsePassRisks(passReasonText)        -> { passRisks, likedTraits }   (Prompt 1)
 *   labelProofPoint(riskCode, candidate)  -> { label, quote }             (Prompt 2)
 * Without them the run still gathers and caches evidence, but produces no labeled
 * proof points — and then refuses to overwrite deals.json unless --force, because
 * lib/deals.ts prefers deals.json over data/mock-deals.json and an empty file
 * would blank out the UI A is building against.
 *
 * Scoring is NOT done here beyond filling the fields: lib/deals.ts re-scores on
 * every read (so founder proofs change status without a re-prefetch). We still
 * call scoreDeal so the committed fixture is sensible on its own.
 *
 * Schedule (plan): run 12:30 for all 30, rerun 2:30, FREEZE 2:45 and commit.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";

import { rowsFromCsv } from "../lib/passlog/csv";
import type { PassLogRow } from "../lib/passlog/types";
import { resolveCompany, getNewsSince, getCompanySections } from "../lib/akta";
import { hackerNewsSince } from "../lib/signals";
import { scoreDeal } from "../lib/scoring";
import type { ProofCandidate } from "../lib/partb-types";
import type { DealResult, PassRisk, PassedDeal, ProofLabel, ProofPoint, RiskCode, Thesis } from "../lib/types";

const ROOT = process.cwd();
const LEDGER = path.join(ROOT, "data", "pass-ledger.csv");
const OUT = path.join(ROOT, "data", "fixtures", "deals.json");
const OUT_PARTIAL = path.join(ROOT, "data", "fixtures", "deals.partial.json");

/** Most proof points we ask C to label per deal (newest first), to keep a run fast. */
const MAX_CANDIDATES_PER_DEAL = 10;

/** Akta news tags that count as matching a risk (drives the 1.0 strength tier). */
const RISK_TAGS: Record<RiskCode, string[]> = {
  PRE_PRODUCT: ["product launch", "product", "launch", "release"],
  NO_ENTERPRISE_CUSTOMERS: ["partnership", "customer", "customer win", "enterprise", "contract"],
  TOO_EARLY_REVENUE: ["funding", "revenue", "financial results", "growth"],
  TEAM_GAP: ["management change", "hiring", "appointment", "executive"],
  GTM_UNPROVEN: ["partnership", "distribution", "channel", "expansion", "go to market"],
  MARKET_SIZE: ["market", "industry", "expansion"],
  ROUND_DYNAMICS: ["funding", "investment", "round", "valuation"],
};

async function main() {
  await loadEnv();
  process.env.AKTA_CAPTURE = process.env.AKTA_CAPTURE ?? "1";
  const force = process.argv.includes("--force");

  if (!process.env.AKTA_API_KEY) {
    console.warn("[prefetch] AKTA_API_KEY not set — Akta returns 'no_api_key'; only Hacker News evidence will be gathered.");
  }

  const thesis = JSON.parse(await fs.readFile(path.join(ROOT, "data", "thesis.json"), "utf8")) as Thesis;
  const { rows, skipped, errors } = rowsFromCsv(await fs.readFile(LEDGER, "utf8"), "harbor_street");
  if (errors.length) {
    console.error("[prefetch] ledger errors:", errors.join("; "));
    process.exit(1);
  }
  if (skipped.length) console.warn(`[prefetch] skipped ${skipped.length} row(s):`, skipped.map((s) => s.company_name).join(", "));

  const c = await loadPrompts();
  if (!c.parsePassRisks) console.warn("[prefetch] lib/prompts#parsePassRisks not found — passRisks will be empty.");
  if (!c.labelProofPoint) console.warn("[prefetch] lib/prompts#labelProofPoint not found — proofPoints will be empty.");

  const results: DealResult[] = [];
  let totalCandidates = 0;
  let totalProofPoints = 0;

  for (const [i, r] of rows.entries()) {
    process.stdout.write(`[prefetch] (${i + 1}/${rows.length}) ${r.company_name} ... `);

    const deal = toPassedDeal(r);
    const candidates = await gatherEvidence(r);
    totalCandidates += candidates.length;

    // C Prompt 1: pass reason -> risks + liked traits.
    let passRisks: PassRisk[] = [];
    let likedTraits: string[] = [];
    if (c.parsePassRisks) {
      try {
        const parsed = await c.parsePassRisks(r.pass_reason_text);
        passRisks = parsed.passRisks ?? [];
        likedTraits = parsed.likedTraits ?? [];
      } catch (e) {
        console.warn(`\n[prefetch] parsePassRisks failed for ${r.company_name}: ${(e as Error).message}`);
      }
    }

    // C Prompt 2: label each candidate against each risk.
    const proofPoints = c.labelProofPoint ? await labelAll(deal, passRisks, candidates, c.labelProofPoint) : [];
    totalProofPoints += proofPoints.length;

    const scored = scoreDeal({ deal, passRisks, proofPoints }, thesis);

    results.push({
      view: "anti_portfolio",
      deal,
      passRisks,
      likedTraits,
      proofPoints: scored.proofPoints,
      assessments: scored.assessments,
      conviction: scored.conviction,
      allocationRisk: scored.allocationRisk,
      trackerToken: randomBytes(9).toString("base64url").slice(0, 12),
      prismChecked: false,
      affinitySynced: false,
    });

    console.log(`${candidates.length} candidates, ${proofPoints.length} proof points`);
  }

  await fs.mkdir(path.dirname(OUT), { recursive: true });
  const json = JSON.stringify(results, null, 2);

  if (totalProofPoints === 0 && !force) {
    await fs.writeFile(OUT_PARTIAL, json, "utf8");
    console.log(`\n[prefetch] ${results.length} deals, ${totalCandidates} raw candidates, 0 labeled proof points.`);
    console.log(`[prefetch] wrote ${path.relative(ROOT, OUT_PARTIAL)} instead of deals.json, so the UI keeps using data/mock-deals.json.`);
    console.log("[prefetch] re-run once AKTA_API_KEY and lib/prompts exist, or pass --force to write deals.json anyway.");
    return;
  }

  await fs.writeFile(OUT, json, "utf8");
  console.log(`\n[prefetch] wrote ${results.length} deals (${totalProofPoints} proof points) -> ${path.relative(ROOT, OUT)}`);
}

function toPassedDeal(r: PassLogRow): PassedDeal {
  return {
    dealId: slug(r.company_name),
    companyName: r.company_name,
    domain: r.domain,
    passDate: r.pass_date,
    partnerName: r.partner,
    stageAtPass: r.stage_at_pass,
    sector: r.sector,
    passReasonText: r.pass_reason_text,
  };
}

/** Akta news + sections + Hacker News since the pass date, newest first. */
async function gatherEvidence(r: PassLogRow): Promise<ProofCandidate[]> {
  const out: ProofCandidate[] = [];

  if (r.domain) {
    await resolveCompany(r.domain); // caches the UUID / warms the fixture

    const news = await getNewsSince(r.domain, r.pass_date);
    if (!news.reason)
      for (const n of news.data)
        out.push({
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

  out.push(...(await hackerNewsSince(r.company_name, r.pass_date)));

  // Drop anything at or before the pass date: scoring would score it 0 anyway.
  return out.filter((p) => p.publishedDate > r.pass_date).sort((a, b) => (a.publishedDate < b.publishedDate ? 1 : -1));
}

async function labelAll(
  deal: PassedDeal,
  passRisks: PassRisk[],
  candidates: ProofCandidate[],
  label: LabelProofPoint,
): Promise<ProofPoint[]> {
  const out: ProofPoint[] = [];
  const shortlist = candidates.slice(0, MAX_CANDIDATES_PER_DEAL);
  let n = 0;

  for (const risk of passRisks) {
    for (const cand of shortlist) {
      try {
        const { label: verdict, quote } = await label(risk.riskCode, cand);
        if (verdict === "irrelevant") continue;
        out.push({
          proofId: `${deal.dealId}-${risk.riskCode}-${n++}`,
          source: cand.source,
          sourceName: cand.sourceName,
          url: cand.url,
          publishedDate: cand.publishedDate,
          quote,
          riskCode: risk.riskCode,
          label: verdict,
          strength: 0, // set by lib/scoring
          primaryCompany: cand.primaryCompany,
          tagMatchesRisk: tagMatchesRisk(risk.riskCode, cand.tags),
        });
      } catch (e) {
        console.warn(`\n[prefetch] labelProofPoint failed (${deal.companyName}/${risk.riskCode}): ${(e as Error).message}`);
      }
    }
  }
  return out;
}

function tagMatchesRisk(riskCode: RiskCode, tags: string[]): boolean {
  const wanted = RISK_TAGS[riskCode] ?? [];
  return tags.some((t) => wanted.some((w) => t.includes(w)));
}

// --- optional C hooks ----------------------------------------------------------
type ParsePassRisks = (passReasonText: string) => Promise<{ passRisks: PassRisk[]; likedTraits: string[] }>;
type LabelProofPoint = (riskCode: RiskCode, candidate: ProofCandidate) => Promise<{ label: ProofLabel; quote: string }>;

async function loadPrompts(): Promise<{ parsePassRisks?: ParsePassRisks; labelProofPoint?: LabelProofPoint }> {
  // Non-literal specifier on purpose: lib/prompts is C's and may not exist yet,
  // and a literal would fail `tsc --noEmit` for everyone until it lands.
  const spec = "../lib/prompts";
  try {
    const mod: any = await import(spec);
    return {
      parsePassRisks: typeof mod.parsePassRisks === "function" ? mod.parsePassRisks : undefined,
      labelProofPoint: typeof mod.labelProofPoint === "function" ? mod.labelProofPoint : undefined,
    };
  } catch {
    return {};
  }
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
