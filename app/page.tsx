export const dynamic = "force-dynamic";

import Link from "next/link";
import {
  countByOverall,
  formatDate,
  getRanked,
  integrationStatus,
  IS_SAMPLE,
  NETWORK_SAMPLE,
  recentEvidence,
} from "../lib/secondlook/data";
import { OBJECTION_LABEL, SOURCE_LABEL } from "../lib/secondlook/types";
import { SampleTag, SectionTitle, Stat, TextLink, VerdictChip } from "../components/ui";
import WaitingOnYou from "../components/WaitingOnYou";
import Starfield from "../components/motion/Starfield";
import HeroLoop from "../components/motion/HeroLoop";

export default async function OverviewPage() {
  const [ranked, evidence] = await Promise.all([getRanked(), recentEvidence(5)]);
  const counts = countByOverall(ranked);
  const ready = ranked.filter((r) => r.overall === "RESOLVED");
  const top = ranked.slice(0, 4);
  const integrations = integrationStatus();
  const network = [...NETWORK_SAMPLE.rows].sort((a, b) => b.cameTruePct - a.cameTruePct).slice(0, 3);

  return (
    <>
      <section className="relative text-white">
        <div className="absolute inset-y-0 left-1/2 w-screen -translate-x-1/2 overflow-hidden bg-night" aria-hidden>
          <Starfield />
        </div>
        <div className="relative grid gap-10 pb-16 pt-16 md:grid-cols-[1.1fr_1fr] md:items-center md:pb-20 md:pt-20">
          <div>
            <h1 className="font-serif text-balance text-[40px] leading-[48px] tracking-[-0.02em] md:text-[56px] md:leading-[66px]">
              {ready.length} passes are worth a second look.
            </h1>
            <p className="mt-5 max-w-xl text-[17px] leading-8 text-white/70">
              Every pass risk behind them is de-risked, with dated proof points from Akta news and SEC filings.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/anti-portfolio"
                className="inline-flex items-center bg-white px-5 py-2.5 font-ui text-[14px] font-medium text-ink transition-colors hover:bg-linen"
              >
                Open the Anti-Portfolio
              </Link>
              <Link
                href="/import"
                className="inline-flex items-center border border-white/40 px-5 py-2.5 font-ui text-[14px] font-medium text-white transition-colors hover:border-white"
              >
                Import passes
              </Link>
            </div>
          </div>
          <div className="flex justify-center md:justify-end">
            <HeroLoop />
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 divide-rule border-b border-rule md:grid-cols-4 md:divide-x">
        <Stat value={ranked.length} label="Passes tracked" />
        <Stat value={counts.RESOLVED} label="De-risked" note="Ready for a second look" />
        <Stat value={counts.PARTIAL} label="Partially de-risked" note="Some proof" />
        <Stat
          value={counts.NOT_YET + counts.INSUFFICIENT_DATA + counts.JUDGMENT_CALL}
          label="Open"
          note="Including no coverage and partner calls"
        />
      </section>

      <section className="mt-14 grid gap-14 md:grid-cols-[1.6fr_1fr]">
        <div>
          <SectionTitle aside={<TextLink href="/anti-portfolio">See all {ranked.length}</TextLink>}>Top of the queue</SectionTitle>
          <ul>
            {top.map((r) => (
              <li key={r.company.id} className="border-b border-rule-soft">
                <Link href={`/brief/${r.company.id}`} className="grid gap-3 py-5 transition-colors hover:bg-linen md:grid-cols-[1fr_auto] md:px-3">
                  <div>
                    <p className="font-serif text-[19px] leading-7">{r.company.name}</p>
                    <p className="mt-1 font-serif text-[15px] italic text-graphite">&ldquo;{r.company.pass_reason_text}&rdquo;</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {r.objections.map((o) => (
                        <VerdictChip key={o.code} verdict={o.verdict}>
                          {OBJECTION_LABEL[o.code]}
                        </VerdictChip>
                      ))}
                    </div>
                  </div>
                  <div className="text-left md:text-right">
                    <p className="num font-serif text-[28px] leading-8">{r.score}</p>
                    <p className="font-ui text-[12px] text-muted">conviction</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <SectionTitle>Latest evidence</SectionTitle>
          <ul>
            {evidence.map((e) => (
              <li key={e.id} className="border-b border-rule-soft py-4">
                <Link href={`/brief/${e.companyId}`} className="group block">
                  <p className="num text-[12px] text-muted">
                    {formatDate(e.published_date)} · {SOURCE_LABEL[e.source]}
                  </p>
                  <p className="mt-1 text-[15px] font-medium group-hover:underline">{e.companyName}</p>
                  <p className="text-[14px] leading-6 text-graphite">{e.title}</p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mt-16 bg-linen px-5 py-12 md:px-10">
        <div className="grid gap-14 md:grid-cols-3">
          <WaitingOnYou ready={ready.map((r) => ({ id: r.company.id, name: r.company.name, partner: r.company.partner }))} />

          <div>
            <SectionTitle>What usually happens next</SectionTitle>
            <ul>
              {network.map((n) => (
                <li key={n.code} className="flex items-baseline justify-between gap-4 border-b border-rule-soft py-3">
                  <span className="text-[15px]">{OBJECTION_LABEL[n.code]}</span>
                  <span className="num text-[14px] text-graphite">
                    {n.cameTruePct}% de-risked{n.medianMonths ? `, ~${n.medianMonths} mo` : ""}
                  </span>
                </li>
              ))}
            </ul>
            {IS_SAMPLE ? (
              <p className="mt-3">
                <SampleTag>Sample network numbers</SampleTag>
              </p>
            ) : null}
            <p className="mt-4">
              <TextLink href="/network">See every pass risk</TextLink>
            </p>
          </div>

          <div>
            <SectionTitle>Data sources</SectionTitle>
            <ul>
              {integrations.map((i) => (
                <li key={i.name} className="flex items-baseline justify-between gap-4 border-b border-rule-soft py-3">
                  <span>
                    <span className="text-[15px]">{i.name}</span>
                    <span className="block font-ui text-[12px] text-muted">{i.role}</span>
                  </span>
                  <span
                    className={`font-ui text-[13px] ${
                      i.state === "connected" ? "text-pine" : i.state === "demo" ? "text-cognac" : "text-muted"
                    }`}
                  >
                    {i.state === "connected" ? "Connected" : i.state === "demo" ? "Demo workspace" : "Not configured"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </>
  );
}
