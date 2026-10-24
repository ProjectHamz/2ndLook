/**
 * Single place the pages get data from. Swap the sample imports for real
 * pipeline output when lanes A and B are ready; the pages don't change.
 */
import { COMPANIES, FUNDS, IS_SAMPLE, NETWORK_SAMPLE, PRISM_SAMPLE, TODAY } from "./sample-data";
import { evaluate, rank, type CompanyResult } from "./engine";
import type { EvidenceItem, FundThesis, Verdict } from "./types";

export { IS_SAMPLE, TODAY, NETWORK_SAMPLE, PRISM_SAMPLE };

export function getFunds(): FundThesis[] {
  return FUNDS;
}

export function getFund(id?: string | null): FundThesis {
  return FUNDS.find((f) => f.id === id) ?? FUNDS[0]!;
}

export function getRanked(fundId?: string | null): CompanyResult[] {
  return rank(COMPANIES, getFund(fundId), TODAY);
}

export function getCompanyResult(id: string, fundId?: string | null): CompanyResult | null {
  const c = COMPANIES.find((x) => x.id === id);
  return c ? evaluate(c, getFund(fundId), TODAY) : null;
}

export function countByOverall(results: CompanyResult[]): Record<Verdict, number> {
  const out: Record<Verdict, number> = { RESOLVED: 0, PARTIAL: 0, NOT_YET: 0, INSUFFICIENT_DATA: 0, JUDGMENT_CALL: 0 };
  for (const r of results) out[r.overall]++;
  return out;
}

export type EvidenceWithCompany = EvidenceItem & { companyId: string; companyName: string };

export function recentEvidence(limit = 5): EvidenceWithCompany[] {
  return COMPANIES.flatMap((c) =>
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
