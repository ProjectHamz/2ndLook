/**
 * Single place the pages get data from. Reads funds, companies and evidence from Supabase
 * (seeded with real Akta data by scripts/seed-akta-data.ts). Without Supabase configured, or if a read fails,
 * it falls back to sample-data.ts so the pages still render.
 */
import { cache } from "react";
import { supabase } from "../supabase";
import { COMPANIES, FUNDS, IS_SAMPLE, PRISM_SAMPLE, TODAY } from "./sample-data";
import { evaluate, rank, type CompanyResult } from "./engine";
import type { Company, EvidenceItem, FundThesis, Verdict } from "./types";

export { IS_SAMPLE, TODAY, PRISM_SAMPLE };

type EvidenceRow = Omit<EvidenceItem, "amount_usd"> & { company_id: string; amount_usd: number | null };
type CompanyRow = Omit<Company, "evidence"> & { evidence: EvidenceRow[] };

/** Once per request (React cache), so a page calling several getters reads the database once. */
const loadFunds = cache(async (): Promise<FundThesis[]> => {
  const db = supabase();
  if (!db) return FUNDS;
  const { data, error } = await db.from("funds").select("*").order("id");
  if (error || !data?.length) {
    console.error("Supabase funds:", error?.message ?? "no rows; run scripts/seed-akta-data.ts");
    return FUNDS;
  }
  return data as FundThesis[];
});

const loadCompanies = cache(async (): Promise<Company[]> => {
  const db = supabase();
  if (!db) return COMPANIES;
  const { data, error } = await db.from("companies").select("*, evidence(*)").order("id");
  if (error || !data?.length) {
    console.error("Supabase companies:", error?.message ?? "no rows; run scripts/seed-akta-data.ts");
    return COMPANIES;
  }
  return (data as CompanyRow[]).map((c) => ({
    ...c,
    evidence: c.evidence.map(({ company_id: _companyId, amount_usd, ...e }) => ({
      ...e,
      ...(amount_usd == null ? {} : { amount_usd }),
    })),
  }));
});

export async function getFunds(): Promise<FundThesis[]> {
  return loadFunds();
}

export async function getFund(id?: string | null): Promise<FundThesis> {
  const funds = await loadFunds();
  return funds.find((f) => f.id === id) ?? funds[0]!;
}

/** The fund shown when no ?fund= is given; links leave it out of the URL. */
export async function getDefaultFundId(): Promise<string> {
  return (await loadFunds())[0]!.id;
}

/** True when Supabase isn't configured or failed, so the pages show the fictional sample-data.ts. */
export async function usingSampleData(): Promise<boolean> {
  const [funds, companies] = await Promise.all([loadFunds(), loadCompanies()]);
  return funds === FUNDS || companies === COMPANIES;
}

export async function getRanked(fundId?: string | null): Promise<CompanyResult[]> {
  const [companies, fund] = await Promise.all([loadCompanies(), getFund(fundId)]);
  return rank(companies, fund, TODAY);
}

export async function getCompanyResult(id: string, fundId?: string | null): Promise<CompanyResult | null> {
  const [companies, fund] = await Promise.all([loadCompanies(), getFund(fundId)]);
  const c = companies.find((x) => x.id === id);
  return c ? evaluate(c, fund, TODAY) : null;
}

/** Partners on the pass log, A to Z (owner picker on the brief). */
export async function getPartners(): Promise<string[]> {
  return [...new Set((await loadCompanies()).map((c) => c.partner))].sort((a, b) => a.localeCompare(b));
}

export function countByOverall(results: CompanyResult[]): Record<Verdict, number> {
  const out: Record<Verdict, number> = { RESOLVED: 0, PARTIAL: 0, NOT_YET: 0, INSUFFICIENT_DATA: 0, JUDGMENT_CALL: 0 };
  for (const r of results) out[r.overall]++;
  return out;
}

export type EvidenceWithCompany = EvidenceItem & { companyId: string; companyName: string };

export async function recentEvidence(limit = 5): Promise<EvidenceWithCompany[]> {
  return (await loadCompanies()).flatMap((c) =>
    c.evidence
      .filter((e) => e.published_date > c.pass_date && e.llm_label !== "irrelevant")
      .map((e) => ({ ...e, companyId: c.id, companyName: c.name })),
  )
    .sort((a, b) => b.published_date.localeCompare(a.published_date))
    .slice(0, limit);
}

export type IntegrationStatus = { name: string; role: string; state: "connected" | "demo" | "not configured" };

/** Real status from environment variables (server only). */
export function integrationStatus(): IntegrationStatus[] {
  const has = (k: string) => Boolean(process.env[k]);
  return [
    { name: "Affinity", role: "Pass log", state: has("AFFINITY_API_KEY") ? "connected" : "demo" },
    { name: "akta.pro", role: "Company news and signals", state: has("AKTA_API_KEY") ? "connected" : "not configured" },
    { name: "SEC EDGAR", role: "Form D filings", state: "connected" },
    { name: "Nicrron", role: "AI gateway", state: has("NICRRON_API_KEY") ? "connected" : "not configured" },
    { name: "PRISM", role: "AI run tracing and rules", state: has("PRISMTRACE_API_KEY") ? "connected" : "not configured" },
    { name: "Roundtable", role: "Shared network between fund agents", state: has("ROUNDTABLE_API_KEY") ? "connected" : "not configured" },
  ];
}

export function formatDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export function monthsBetween(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / (30.44 * 86400000));
}
