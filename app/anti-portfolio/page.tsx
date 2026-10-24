import Link from "next/link";
import { formatDate, getFund, getFunds, getRanked, monthsBetween } from "../../lib/secondlook/data";
import type { CompanyResult } from "../../lib/secondlook/engine";
import { OBJECTION_LABEL, SOURCE_LABEL, type Verdict } from "../../lib/secondlook/types";
import { PageHeader, ScoreBreakdown, VerdictChip } from "../../components/ui";

const FILTERS: { id: string; label: string; match: (v: Verdict) => boolean }[] = [
  { id: "all", label: "All", match: () => true },
  { id: "derisked", label: "De-risked", match: (v) => v === "RESOLVED" },
  { id: "partial", label: "Partially de-risked", match: (v) => v === "PARTIAL" },
  { id: "open", label: "Open", match: (v) => v === "NOT_YET" || v === "INSUFFICIENT_DATA" || v === "JUDGMENT_CALL" },
];

type SearchParams = Promise<{ fund?: string; show?: string }>;

export default async function QueuePage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const fund = await getFund(sp.fund);
  const [all, funds] = await Promise.all([getRanked(fund.id), getFunds()]);
  const filter = FILTERS.find((f) => f.id === sp.show) ?? FILTERS[0]!;
  const rows = all.filter((r) => filter.match(r.overall));
  const qs = (p: { fund?: string; show?: string }) => {
    const u = new URLSearchParams();
    const f = p.fund ?? fund.id;
    const s = p.show ?? filter.id;
    if (f !== "fund-a") u.set("fund", f);
    if (s !== "all") u.set("show", s);
    const str = u.toString();
    return str ? `/anti-portfolio?${str}` : "/anti-portfolio";
  };

  return (
    <>
      <PageHeader
        title="Updated deals to review"
        lede="Each pass risk is checked against Akta news and SEC filings since the pass date. Status first, conviction second."
        aside={
          <div className="flex flex-col gap-2">
            <span className="font-ui text-[13px] text-graphite">Rank for</span>
            <div className="flex">
              {funds.map((f) => (
                <Link
                  key={f.id}
                  href={qs({ fund: f.id })}
                  className={`border px-4 py-2 font-ui text-[14px] ${
                    f.id === fund.id ? "border-pine bg-pine text-white" : "border-rule text-graphite hover:bg-linen"
                  } -ml-px first:ml-0`}
                >
                  {f.name.replace(" (sample)", "")}
                </Link>
              ))}
            </div>
          </div>
        }
      />

      <div className="border-b border-rule bg-linen px-5 md:px-6">
        <div className="flex gap-7 overflow-x-auto">
          {FILTERS.map((f) => {
            const n = all.filter((r) => f.match(r.overall)).length;
            const active = f.id === filter.id;
            return (
              <Link
                key={f.id}
                href={qs({ show: f.id })}
                className={`whitespace-nowrap border-b-2 py-4 font-ui text-[14px] ${
                  active ? "border-pine text-ink" : "border-transparent text-graphite hover:text-ink"
                }`}
              >
                {f.label} <span className="num text-muted">({n})</span>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="mt-8 overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse text-left">
          <thead>
            <tr className="border-y border-ink text-[13px] text-graphite">
              <th className="py-3 pr-6 font-medium">Company</th>
              <th className="py-3 pr-6 font-medium">Pass risks</th>
              <th className="py-3 pr-6 font-medium">Newest proof point</th>
              <th className="py-3 text-right font-medium">Conviction</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <Row key={r.company.id} r={r} fundId={fund.id} />
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? <p className="py-10 text-graphite">Nothing in this group.</p> : null}
      </div>
    </>
  );
}

function Row({ r, fundId }: { r: CompanyResult; fundId: string }) {
  const c = r.company;
  const proof = r.objections
    .flatMap((o) => o.evidence)
    .filter((e) => e.llm_label === "supports")
    .sort((a, b) => b.published_date.localeCompare(a.published_date))[0];
  const href = `/brief/${c.id}${fundId !== "fund-a" ? `?fund=${fundId}` : ""}`;
  return (
    <tr className="group border-b border-rule-soft align-top transition-colors hover:bg-linen">
      <td className="py-5 pr-6">
        <Link href={href} className="font-serif text-[19px] leading-7 group-hover:underline">
          {c.name}
        </Link>
        <p className="num text-[13px] text-graphite">
          Passed {formatDate(c.pass_date)} by {c.partner}
        </p>
        <p className="mt-2 max-w-[300px] border-l border-rule pl-3 font-serif text-[15px] italic leading-6 text-graphite">
          &ldquo;{c.pass_reason_text}&rdquo;
        </p>
      </td>
      <td className="py-5 pr-6">
        <div className="flex flex-col items-start gap-2">
          {r.objections.map((o) => (
            <VerdictChip key={o.code} verdict={o.verdict}>
              {OBJECTION_LABEL[o.code]}
            </VerdictChip>
          ))}
        </div>
        {r.stageDrift ? (
          <p className="mt-3 max-w-[220px] font-ui text-[12px] leading-5 text-cognac">
            Allocation risk: the new round is above this fund&apos;s check size.
          </p>
        ) : null}
      </td>
      <td className="max-w-[360px] py-5 pr-6">
        {proof ? (
          <>
            <p className="num text-[12px] text-muted">
              {SOURCE_LABEL[proof.source]} · {formatDate(proof.published_date)} ·{" "}
              {monthsBetween(c.pass_date, proof.published_date)} mo after the pass
            </p>
            <p className="mt-1 text-[15px] leading-6">{proof.title}</p>
          </>
        ) : (
          <p className="text-[14px] text-muted">
            {r.overall === "INSUFFICIENT_DATA" ? "No coverage: no public news since the pass." : "No supporting proof points yet."}
          </p>
        )}
      </td>
      <td className="py-5 text-right">
        <p className="num font-serif text-[28px] leading-8">{r.score}</p>
        <ScoreBreakdown resolution={r.resolution} fit={r.thesisFit} momentum={r.momentum} />
        <p className="mt-3">
          <Link href={href} className="text-[14px] font-medium text-pine hover:underline">
            Open memo
          </Link>
        </p>
      </td>
    </tr>
  );
}
