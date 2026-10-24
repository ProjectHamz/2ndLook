/**
 * Prints SQL that loads B's real prefetch (data/fixtures/prefetched.json) into Supabase:
 * Harbor Street Ventures (data/thesis.json), its 30 passed companies, and their verified
 * Akta / Hacker News proof points. Re-runnable: replaces every row in one transaction.
 *
 *   npx tsx scripts/seed-akta-data.ts | psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1
 *
 * The companies and proof points are real; the fund, partners and pass notes are fictional.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Company, EvidenceItem, EvidenceSource, FundThesis, ObjectionCode } from "../lib/secondlook/types";
import { insert } from "./sql";

type Prefetched = {
  dealId: string;
  companyName: string;
  domain: string;
  passDate: string;
  partnerName: string;
  stageAtPass: string;
  sector: string;
  passReasonText: string;
  passRisks: { riskCode: ObjectionCode }[];
  proofCandidates: { url: string; title: string }[];
  proofPoints: {
    proofId: string;
    source: EvidenceSource;
    url: string;
    publishedDate: string;
    quote: string;
    riskCode: ObjectionCode;
    label: EvidenceItem["llm_label"];
    primaryCompany?: boolean;
    tagMatchesRisk?: boolean;
  }[];
};

const root = path.join(__dirname, "..");
const read = <T>(file: string) => JSON.parse(readFileSync(path.join(root, file), "utf8")) as T;
const deals = read<Prefetched[]>("data/fixtures/prefetched.json");
const thesis = read<{ fundName: string; sectors: string[]; stages: string[]; keywords: string[]; maxRoundSizeUsd: number }>(
  "data/thesis.json",
);

const fund: FundThesis = {
  id: "harbor_street",
  name: thesis.fundName,
  sectors: thesis.sectors,
  stages: thesis.stages,
  keywords: thesis.keywords,
  max_round_size_usd: thesis.maxRoundSizeUsd,
};

const companies: Company[] = deals.map((d) => ({
  id: d.dealId,
  name: d.companyName,
  domain: d.domain,
  sector: d.sector,
  stage_at_pass: d.stageAtPass,
  pass_date: d.passDate,
  partner: d.partnerName,
  founder_name: "",
  pass_reason_text: d.passReasonText,
  objections: [...new Set(d.passRisks.map((r) => r.riskCode))],
  open_questions: [],
  evidence: d.proofPoints.map((p) => ({
    id: p.proofId,
    source: p.source,
    url: p.url,
    published_date: p.publishedDate,
    // Proof points don't carry the headline; the candidate article with the same URL does.
    title: d.proofCandidates.find((c) => c.url === p.url)?.title ?? p.quote,
    quote: p.quote,
    objection_code: p.riskCode,
    llm_label: p.label,
    primary_company_match: Boolean(p.primaryCompany),
    tag_maps_to_objection: Boolean(p.tagMatchesRisk),
    sentiment: p.label === "supports" ? "positive" : p.label === "contradicts" ? "negative" : "neutral",
  })),
}));

console.log(
  [
    "begin;",
    "delete from evidence;",
    "delete from companies;",
    "delete from funds;",
    insert("funds", [{ ...fund }]),
    insert(
      "companies",
      companies.map(({ evidence: _evidence, ...c }) => ({ ...c })),
    ),
    insert(
      "evidence",
      companies.flatMap((c) => c.evidence.map((e) => ({ company_id: c.id, ...e, amount_usd: e.amount_usd ?? null }))),
    ),
    "commit;",
  ].join("\n"),
);
