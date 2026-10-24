import { getRanked, IS_SAMPLE, NETWORK_SAMPLE } from "../../lib/secondlook/data";
import { OBJECTION_LABEL, OBJECTION_PROOF } from "../../lib/secondlook/types";
import { PageHeader, SampleTag, SectionTitle } from "../../components/ui";

export default async function NetworkPage() {
  const yours = await getRanked();
  const rows = [...NETWORK_SAMPLE.rows].sort((a, b) => b.cameTruePct - a.cameTruePct);
  const max = Math.max(...rows.map((r) => r.cameTruePct));

  return (
    <>
      <PageHeader
        title="Pass risks across the network"
        lede="How often each pass risk gets de-risked, and how long it takes. Shared anonymously between fund agents through Roundtable."
        aside={IS_SAMPLE ? <SampleTag>Sample network numbers</SampleTag> : null}
      />

      <section className="mt-10 overflow-x-auto">
        <table className="w-full min-w-[820px] border-collapse text-left">
          <thead>
            <tr className="border-y border-ink text-[13px] text-graphite">
              <th className="py-3 pr-6 font-medium">Pass risk</th>
              <th className="py-3 pr-6 text-right font-medium">Passes</th>
              <th className="py-3 pr-6 font-medium">De-risked</th>
              <th className="py-3 pr-6 text-right font-medium">Typical time</th>
              <th className="py-3 font-medium">What usually clears it</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.code} className="border-b border-rule-soft transition-colors hover:bg-linen">
                <td className="py-4 pr-6 text-[16px]">{OBJECTION_LABEL[r.code]}</td>
                <td className="num py-4 pr-6 text-right text-[15px]">{r.passes.toLocaleString()}</td>
                <td className="py-4 pr-6">
                  <div className="flex items-center gap-3">
                    <div className="h-[6px] w-[160px] bg-rule-soft">
                      <div
                        className={r.code === "MARKET_SIZE" ? "h-full bg-muted" : "h-full bg-pine"}
                        style={{ width: `${(r.cameTruePct / max) * 100}%` }}
                      />
                    </div>
                    <span className="num text-[15px] font-medium">{r.cameTruePct}%</span>
                  </div>
                </td>
                <td className="num py-4 pr-6 text-right text-[15px]">
                  {r.medianMonths ? `${r.medianMonths} months` : <span className="text-muted">Too few</span>}
                </td>
                <td className="py-4 text-[14px] text-graphite">{OBJECTION_PROOF[r.code]}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="num mt-3 text-[13px] text-muted">
          {NETWORK_SAMPLE.passes.toLocaleString()} passes from {NETWORK_SAMPLE.funds} funds. 
          &ldquo;De-risked&rdquo; means the pass risk was cleared with a dated proof point. Your fund adds {yours.length} passes.
        </p>
      </section>

      <section className="mt-16 grid gap-14 md:grid-cols-2">
        <div>
          <SectionTitle>What we share</SectionTitle>
          <div className="grid grid-cols-2 gap-8 pt-5">
            <div>
              <p className="text-[14px] font-medium text-pine">Shared</p>
              <ul className="mt-2 flex flex-col gap-2 text-[15px]">
                <li>The type of reason</li>
                <li>The pass date</li>
                <li>Whether it was de-risked, and when</li>
              </ul>
            </div>
            <div>
              <p className="text-[14px] font-medium text-graphite">Never shared</p>
              <ul className="mt-2 flex flex-col gap-2 text-[15px] text-graphite">
                <li>Company names</li>
                <li>Fund or partner names</li>
                <li>Your notes</li>
              </ul>
            </div>
          </div>
        </div>
        <div>
          <SectionTitle>How it gets smarter</SectionTitle>
          <p className="pt-5 text-[16px] leading-7 text-graphite">
            We don&apos;t train an AI model. We train the product: the reason types, the rules for what counts as proof,
            and this table of outcomes. Every fund that joins adds outcomes, and every other fund&apos;s numbers get more
            accurate. When a better AI model comes out, we switch to it through Nicrron and keep everything we&apos;ve
            learned.
          </p>
        </div>
      </section>
    </>
  );
}
