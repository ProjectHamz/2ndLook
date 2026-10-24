import { IS_SAMPLE, PRISM_SAMPLE } from "../../lib/secondlook/data";
import { PageHeader, SampleTag, SectionTitle } from "../../components/ui";

const STEPS = [
  { who: "AI, through Nicrron", what: "Reads each messy pass note and turns it into one to three standard reasons." },
  { who: "akta.pro and SEC EDGAR", what: "Return news, company profile updates and Form D filings dated after the pass." },
  {
    who: "AI, through Nicrron",
    what: "Labels each item as supports, contradicts or irrelevant, and must copy a quote word for word.",
  },
  { who: "Fixed rules, no AI", what: "Set each status and the conviction score. Same input, same answer, every time." },
  { who: "PRISM", what: "Traces every AI run and checks it against our rules. Breaks are caught before a partner sees them." },
];

export default function AuditPage() {
  const [v1, v2] = PRISM_SAMPLE.versions;
  return (
    <>
      <PageHeader
        title="How each status is set"
        lede="The AI reads and quotes. Fixed rules set the status. Every AI run is traced in PRISM."
        aside={IS_SAMPLE ? <SampleTag>Sample PRISM numbers</SampleTag> : null}
      />

      <section className="mt-12">
        <SectionTitle>How a status is set</SectionTitle>
        <ol>
          {STEPS.map((s, i) => (
            <li key={i} className="grid gap-2 border-b border-rule-soft py-5 md:grid-cols-[48px_240px_1fr]">
              <span className="num font-serif text-[20px] text-muted">{i + 1}</span>
              <span className="text-[15px] font-medium">{s.who}</span>
              <span className="text-[15px] leading-6 text-graphite">{s.what}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-16 grid gap-14 md:grid-cols-[1.3fr_1fr]">
        <div>
          <SectionTitle aside={PRISM_SAMPLE.model}>Rules checked in PRISM</SectionTitle>
          <ul>
            <li className="border-b border-rule-soft py-4 text-[16px]">{PRISM_SAMPLE.rule}</li>
            <li className="border-b border-rule-soft py-4 text-[16px]">{PRISM_SAMPLE.rule2}</li>
          </ul>

          <table className="mt-10 w-full border-collapse text-left">
            <thead>
              <tr className="border-y border-ink text-[13px] text-graphite">
                <th className="py-3 pr-4 font-medium">Version</th>
                <th className="py-3 pr-4 text-right font-medium">Runs</th>
                <th className="py-3 pr-4 text-right font-medium">Broke the quote rule</th>
                <th className="py-3 font-medium">What changed</th>
              </tr>
            </thead>
            <tbody>
              {[v1, v2].map((v) =>
                v ? (
                  <tr key={v.name} className="border-b border-rule-soft align-top">
                    <td className="py-4 pr-4 font-medium">{v.name}</td>
                    <td className="num py-4 pr-4 text-right">{v.runs}</td>
                    <td className={`num py-4 pr-4 text-right font-medium ${v.violations ? "text-ink" : "text-pine"}`}>
                      {v.violations}
                    </td>
                    <td className="py-4 text-[14px] text-graphite">{v.note}</td>
                  </tr>
                ) : null,
              )}
            </tbody>
          </table>
          <p className="mt-3 text-[13px] text-muted">Same 50 inputs for both versions.</p>
        </div>

        <div>
          <SectionTitle>How conviction is scored</SectionTitle>
          <ul>
            <li className="flex justify-between border-b border-rule-soft py-4">
              <span>De-risking: how many pass risks are cleared</span>
              <span className="num font-medium">50%</span>
            </li>
            <li className="flex justify-between border-b border-rule-soft py-4">
              <span>Thesis fit</span>
              <span className="num font-medium">30%</span>
            </li>
            <li className="flex justify-between border-b border-rule-soft py-4">
              <span>Traction: positive signals since the pass</span>
              <span className="num font-medium">20%</span>
            </li>
          </ul>
          <p className="mt-4 text-[14px] leading-6 text-graphite">
            These weights are a starting point, not a finding. The breakdown is always shown next to the conviction score,
            and the status comes before the rank.
          </p>
        </div>
      </section>
    </>
  );
}
