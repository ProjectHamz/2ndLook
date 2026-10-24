import Link from "next/link";
import comps from "../../data/fixtures/comps.json";
import { formatDate, getRanked, monthsBetween } from "../../lib/secondlook/data";
import { OBJECTION_LABEL, type ObjectionCode, type Verdict } from "../../lib/secondlook/types";
import { PageHeader, VerdictChip } from "../../components/ui";

/** Built by scripts/build-comps.ts from the real Akta prefetch; every quote passed the quote check. */
type Comp = {
  targetRisk: ObjectionCode;
  passedDeal: { dealId: string; companyName: string; passDate: string; partnerName: string; passReasonText: string; sourcePhrase: string };
  comp: { dealId: string; companyName: string; domain: string; sector: string; stageAtPass: string };
  proofPoints: { publishedDate: string; sourceName: string; url: string; quote: string; title: string }[];
};

export const dynamic = "force-dynamic";

/** Fully de-risked comps first, then partially; the same rules the memo pages use. */
const VERDICT_ORDER: Verdict[] = ["RESOLVED", "PARTIAL", "NOT_YET", "INSUFFICIENT_DATA", "JUDGMENT_CALL"];

export default async function CompsPage() {
  // Status comes from the same scoring as the comp's own memo, so the two never disagree.
  const byId = new Map((await getRanked()).map((r) => [r.company.id, r]));
  const rows = (comps as Comp[])
    .map((c) => ({
      ...c,
      verdict: byId.get(c.comp.dealId)?.objections.find((o) => o.code === c.targetRisk)?.verdict ?? ("PARTIAL" as Verdict),
    }))
    .filter((c) => c.verdict === "RESOLVED" || c.verdict === "PARTIAL")
    .sort((a, b) => VERDICT_ORDER.indexOf(a.verdict) - VERDICT_ORDER.indexOf(b.verdict));
  return (
    <>
      <PageHeader
        title="Comps that already cleared the bar"
        lede="Sometimes the better move isn't going back to a founder you passed on. It's a comparable company that has already cleared, or partly cleared, the exact risk you passed for."
        aside={<span className="font-ui text-[13px] text-graphite">These companies are also in your pass log.</span>}
      />

      <div className="mt-8 overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse text-left">
          <thead>
            <tr className="border-y border-ink text-[13px] text-graphite">
              <th className="py-3 pr-6 font-medium">Comp</th>
              <th className="py-3 pr-6 font-medium">Comp to</th>
              <th className="py-3 pr-6 font-medium">Strongest proof point</th>
              <th className="py-3 text-right font-medium">Proof points</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <Row key={`${r.comp.dealId}-${r.passedDeal.dealId}`} r={r} />
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Row({ r }: { r: Comp & { verdict: Verdict } }) {
  const proof = r.proofPoints[0]; // strongest first (see scripts/build-comps.ts)
  return (
    <tr className="group border-b border-rule-soft align-top transition-colors hover:bg-linen">
      <td className="py-5 pr-6">
        <Link href={`/brief/${r.comp.dealId}`} className="font-serif text-[19px] leading-7 group-hover:underline">
          {r.comp.companyName}
        </Link>
        <p className="num text-[13px] text-graphite">
          {r.comp.sector}, {r.comp.domain}
        </p>
        <div className="mt-3">
          <VerdictChip verdict={r.verdict}>{OBJECTION_LABEL[r.targetRisk]}</VerdictChip>
        </div>
      </td>
      <td className="max-w-[300px] py-5 pr-6">
        <Link href={`/brief/${r.passedDeal.dealId}`} className="font-serif text-[17px] leading-7 hover:underline">
          {r.passedDeal.companyName}
        </Link>
        <p className="num text-[13px] text-graphite">
          Passed {formatDate(r.passedDeal.passDate)} by {r.passedDeal.partnerName}
        </p>
        <p className="mt-2 border-l border-rule pl-3 font-serif text-[15px] italic leading-6 text-graphite">
          &ldquo;{r.passedDeal.sourcePhrase || r.passedDeal.passReasonText}&rdquo;
        </p>
      </td>
      <td className="max-w-[380px] py-5 pr-6">
        {proof ? (
          <>
            <p className="num text-[12px] text-muted">
              {proof.sourceName} · {formatDate(proof.publishedDate)} · {monthsBetween(r.passedDeal.passDate, proof.publishedDate)} mo
              after you passed on {r.passedDeal.companyName}
            </p>
            <p className="mt-2 border-l-2 border-cognac pl-3 text-[15px] leading-6">&ldquo;{proof.quote}&rdquo;</p>
            {proof.title ? <p className="mt-2 text-[13px] leading-5 text-graphite">{proof.title}</p> : null}
            <a href={proof.url} target="_blank" rel="noreferrer" className="mt-2 inline-block font-ui text-[13px] text-cognac hover:underline">
              Read source
            </a>
          </>
        ) : null}
      </td>
      <td className="py-5 text-right">
        <p className="num font-serif text-[28px] leading-8">{r.proofPoints.length}</p>
        <p className="mt-3">
          <Link href={`/brief/${r.comp.dealId}`} className="text-[14px] font-medium text-pine hover:underline">
            Open memo
          </Link>
        </p>
      </td>
    </tr>
  );
}
