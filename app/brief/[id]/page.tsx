import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDate, getCompanyResult, getFund, getPartners, monthsBetween, TODAY } from "../../../lib/secondlook/data";
import { draftEmail } from "../../../lib/secondlook/email";
import { OBJECTION_LABEL, OBJECTION_PROOF, SOURCE_LABEL } from "../../../lib/secondlook/types";
import { ScoreBreakdown, SectionTitle, VerdictChip } from "../../../components/ui";
import EmailApproval from "../../../components/EmailApproval";

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ fund?: string }>;

export default async function BriefPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const { id } = await params;
  const sp = await searchParams;
  const fund = await getFund(sp.fund);
  const [r, partners] = await Promise.all([getCompanyResult(id, fund.id), getPartners()]);
  if (!r) notFound();
  const c = r.company;
  const evidence = r.objections
    .flatMap((o) => o.evidence)
    .sort((a, b) => b.published_date.localeCompare(a.published_date));
  const email = draftEmail(r);
  const allDerisked = r.objections.length > 0 && r.objections.every((o) => o.verdict === "RESOLVED");
  const canEmail = r.objections.some((o) => o.verdict === "RESOLVED" || o.verdict === "PARTIAL");

  return (
    <>
      <div className="flex items-center justify-between border-b border-rule py-4 text-[14px]">
        <Link href={`/anti-portfolio${fund.id !== "fund-a" ? `?fund=${fund.id}` : ""}`} className="text-graphite hover:text-ink">
          Back to the Anti-Portfolio
        </Link>
      </div>

      <header className="grid gap-8 border-b border-ink pb-8 pt-10 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <h1 className="font-serif text-balance text-[40px] leading-[48px] tracking-[-0.02em] md:text-[52px] md:leading-[60px]">{c.name}</h1>
          <p className="mt-2 font-ui text-[16px] text-graphite">
            {c.sector} · {c.stage_at_pass} at the time · {c.domain}
          </p>
          <p className="num mt-4 text-[14px] text-graphite">
            Passed {formatDate(c.pass_date)} by {c.partner}. That was {monthsBetween(c.pass_date, TODAY)} months ago.
          </p>
        </div>
        <div className="md:border-l md:border-rule md:pl-8 md:text-right">
          <p className="font-ui text-[13px] text-graphite">Conviction for {fund.name.replace(" (sample)", "")}</p>
          <p className="num font-serif text-[44px] leading-[52px]">
            {r.score}
            <span className="text-[18px] text-muted"> / 100</span>
          </p>
          <ScoreBreakdown resolution={r.resolution} fit={r.thesisFit} momentum={r.momentum} />
        </div>
      </header>

      <section className="grid md:grid-cols-2">
        <div className="border-rule py-10 md:border-r md:pr-12">
          <h2 className="font-ui text-[14px] font-medium text-graphite">Why you passed</h2>
          <blockquote className="mt-4 border-l-2 border-ink pl-6 font-serif text-[26px] italic leading-[38px] md:text-[30px] md:leading-[42px]">
            <span className={allDerisked ? "strike" : undefined}>&ldquo;{c.pass_reason_text}&rdquo;</span>
          </blockquote>
          <p className="mt-3 pl-6 font-ui text-[13px] text-muted">
            {c.partner}&apos;s note, word for word{allDerisked ? ". Every pass risk is now de-risked." : ""}
          </p>

          <ul className="mt-10">
            {r.objections.map((o) => (
              <li key={o.code} className="flex items-start justify-between gap-4 border-t border-rule-soft py-4">
                <div>
                  <p className="text-[15px] font-medium">{OBJECTION_LABEL[o.code]}</p>
                  <p className="text-[13px] text-graphite">Cleared by: {OBJECTION_PROOF[o.code].toLowerCase()}</p>
                </div>
                <VerdictChip verdict={o.verdict} />
              </li>
            ))}
          </ul>
        </div>

        <div className="border-t border-rule py-10 md:border-t-0 md:pl-12">
          <h2 className="font-ui text-[14px] font-medium text-graphite">What changed</h2>
          {evidence.length === 0 ? (
            <p className="mt-4 text-[16px] leading-7 text-graphite">
              No public news since the pass. That means no coverage, not a no. A short check-in note is the best next
              step.
            </p>
          ) : (
            <ul className="mt-2">
              {evidence.map((e) => (
                <li key={e.id} className="border-b border-rule-soft py-5">
                  <p className="num flex flex-wrap justify-between gap-2 text-[12px] text-muted">
                    <span>
                      {SOURCE_LABEL[e.source]} · {OBJECTION_LABEL[e.objection_code]}
                    </span>
                    <span>
                      {formatDate(e.published_date)}, {monthsBetween(c.pass_date, e.published_date)} mo after the pass
                    </span>
                  </p>
                  <p className="mt-2 text-[16px] font-medium leading-6">{e.title}</p>
                  <p className="mt-2 border-l border-rule pl-4 text-[15px] leading-6 text-graphite">&ldquo;{e.quote}&rdquo;</p>
                  <p className="mt-2 text-[12px] text-muted">
                    {e.llm_label === "supports"
                      ? e.primary_company_match && e.tag_maps_to_objection
                        ? "Strong: about this company, and the event type matches the pass risk."
                        : "Weaker: a passing mention, or only the AI linked it to the pass risk."
                      : e.llm_label === "contradicts"
                        ? "Contradicts this pass risk being cleared."
                        : "Not relevant to this pass risk."}{" "}
                    <a href={e.url} className="underline-offset-2 hover:underline" target="_blank" rel="noreferrer">
                      Source
                    </a>
                  </p>
                </li>
              ))}
            </ul>
          )}

          {c.open_questions.length > 0 ? (
            <div className="mt-8">
              <h3 className="font-ui text-[14px] font-medium text-graphite">Ask in the meeting</h3>
              <ul className="mt-2 list-disc pl-5 text-[15px] leading-7">
                {c.open_questions.map((q) => (
                  <li key={q}>{q}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </section>

      <section id="email" className="mt-6 scroll-mt-24">
        <SectionTitle aside="Nothing is sent without your approval">Re-engagement note</SectionTitle>
        <EmailApproval
          companyId={c.id}
          to={`${c.founder_name} <founder@${c.domain}>`}
          defaultOwner={c.partner}
          owners={partners}
          subject={email.subject}
          body={email.body}
          canEmail={canEmail}
          today={TODAY}
        />
      </section>
    </>
  );
}
