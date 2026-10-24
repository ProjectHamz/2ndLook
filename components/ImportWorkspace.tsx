"use client";

import Link from "next/link";
import ConnectAffinity from "./ConnectAffinity";
import { useAppState } from "./AppState";
import { SectionTitle } from "./ui";

function fmt(iso: string) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default function ImportWorkspace() {
  const { lastImport, setLastImport } = useAppState();
  const rows = lastImport?.rows ?? [];
  const withDomain = rows.filter((r) => r.domain).length;

  const steps = [
    {
      title: "Match companies",
      detail: "Clean up each domain so Akta finds the right company.",
      value: lastImport ? `${withDomain} of ${rows.length}` : "Waiting",
    },
    {
      title: "Find the pass risks",
      detail: "AI turns each note into one to three pass risks.",
      value: lastImport ? `${rows.length} notes` : "Waiting",
    },
    {
      title: "Find proof points",
      detail: "Akta news and SEC Form D filings dated after each pass.",
      value: lastImport ? "Runs in the pipeline" : "Waiting",
    },
    {
      title: "Set each status",
      detail: "Fixed rules decide De-risked, Partially de-risked or Open.",
      value: lastImport ? "See the Anti-Portfolio" : "Waiting",
    },
  ];

  return (
    <>
      <section className="mt-10 grid gap-10 md:grid-cols-[1.4fr_1fr]">
        <div className="border border-rule p-8">
          <h2 className="font-serif text-[24px] leading-8">Connect your deal flow</h2>
          <p className="mt-2 max-w-lg text-[15px] leading-6 text-graphite">
            Works with Affinity&apos;s API. Funds on another CRM can upload a CSV with company, domain, pass date, partner
            and reason.
          </p>
          <div className="mt-6">
            <ConnectAffinity
              onImported={(r, meta) =>
                setLastImport({
                  source: meta.source,
                  mode: meta.mode,
                  listName: meta.listName,
                  rows: r,
                  skipped: meta.skipped,
                  notPassedCount: meta.notPassedCount,
                  at: new Date().toISOString(),
                })
              }
            />
          </div>
        </div>

        <div className="bg-linen p-8">
          <h2 className="font-serif text-[20px] leading-7">Last import</h2>
          {lastImport ? (
            <dl className="mt-4 text-[14px]">
              {[
                ["Source", lastImport.source === "affinity" ? `Affinity, "${lastImport.listName}"` : "CSV file"],
                ["Mode", lastImport.mode === "demo" ? "Demo workspace (synthetic)" : lastImport.mode === "live" ? "Live" : "File"],
                ["Passes imported", String(rows.length)],
                ["Not passes, left out", String(lastImport.notPassedCount ?? 0)],
                ["Skipped", String(lastImport.skipped.length)],
                ["When", new Date(lastImport.at).toLocaleTimeString()],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 border-b border-rule py-2.5">
                  <dt className="text-graphite">{k}</dt>
                  <dd className="num text-right font-medium">{v}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="mt-4 text-[15px] leading-6 text-graphite">Nothing imported yet.</p>
          )}
          <p className="mt-6 text-[13px] leading-5 text-muted">
            Only the reason type, date and outcome ever leave your fund. Company names and notes stay here.
          </p>
        </div>
      </section>

      <section className="mt-14">
        <SectionTitle>What happens next</SectionTitle>
        <div className="relative h-px bg-rule" aria-hidden>
          {lastImport
            ? [0, 1, 2].map((i) => <span key={i} className="travel-dot" style={{ animationDelay: `${i * 1.05}s` }} />)
            : null}
        </div>
        <ol className="grid border-b border-rule md:grid-cols-4 md:divide-x md:divide-rule">
          {steps.map((s, i) => (
            <li key={s.title} className="flex flex-col gap-2 border-b border-rule-soft py-6 md:border-b-0 md:px-6 md:first:pl-0">
              <span className="num text-[13px] text-muted">Step {i + 1}</span>
              <span className="font-serif text-[18px]">{s.title}</span>
              <span className="text-[14px] leading-6 text-graphite">{s.detail}</span>
              {i === 3 && lastImport ? (
                <Link href="/anti-portfolio" className="mt-2 text-[14px] font-medium text-pine hover:underline">
                  See the Anti-Portfolio
                </Link>
              ) : (
                <span className="num mt-2 text-[14px] font-medium">{s.value}</span>
              )}
            </li>
          ))}
        </ol>
      </section>

      {rows.length > 0 ? (
        <section className="mt-14 overflow-x-auto">
          <SectionTitle aside={`${rows.length} passes`}>Imported passes</SectionTitle>
          <table className="w-full min-w-[760px] border-collapse text-left">
            <thead>
              <tr className="border-b border-ink text-[13px] text-graphite">
                <th className="py-3 pr-6 font-medium">Company</th>
                <th className="py-3 pr-6 font-medium">Passed</th>
                <th className="py-3 pr-6 font-medium">Partner</th>
                <th className="py-3 font-medium">Reason, as written</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.company_name}-${r.pass_date}`} className="border-b border-rule-soft align-top hover:bg-linen">
                  <td className="py-4 pr-6">
                    <p className="font-serif text-[17px]">{r.company_name}</p>
                    <p className="text-[13px] text-muted">{r.domain || "No domain"}</p>
                  </td>
                  <td className="num py-4 pr-6 text-[14px]">
                    {fmt(r.pass_date)}
                    {r.pass_date_estimated ? <span className="block text-[12px] text-cognac">Estimated</span> : null}
                  </td>
                  <td className="py-4 pr-6 text-[14px]">{r.partner || "Not recorded"}</td>
                  <td className="py-4 text-[14px] italic text-graphite">&ldquo;{r.pass_reason_text}&rdquo;</td>
                </tr>
              ))}
            </tbody>
          </table>
          {lastImport && lastImport.skipped.length > 0 ? (
            <p className="mt-3 text-[13px] text-muted">
              Skipped: {lastImport.skipped.map((s) => `${s.company_name} (${s.why.toLowerCase()})`).join(", ")}.
            </p>
          ) : null}
        </section>
      ) : null}
    </>
  );
}
