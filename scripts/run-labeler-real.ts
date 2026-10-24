/**
 * PRISM challenge on real data (C). Takes real pass-risk + candidate pairs from the saved
 * prefetch (data/fixtures/prefetched.json) and runs one labeler version on exactly those pairs,
 * so labeler-v1 and labeler-v2 traces in PRISM share the same inputs.
 *
 *   npx tsx scripts/run-labeler-real.ts v1
 *   npx tsx scripts/run-labeler-real.ts v2
 *
 * Reports the two PRISM rules: a "supports" label must quote the source word for word, and
 * its evidence must be dated after the pass. Always calls the model fresh (no cache).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { inBatches, labelProofPoint, type LabelerVersion } from "../lib/ai/labeler";
import type { PrefetchedDeal } from "../lib/partb-types";
import { checkQuote } from "../lib/quoteCheck";
import type { PassRisk } from "../lib/types";

process.env.NICRRON_NO_CACHE = "1";
loadEnv();

const version = (process.argv[2] ?? "v1") as LabelerVersion;
if (version !== "v1" && version !== "v2") throw new Error("Usage: run-labeler-real.ts v1|v2");

type Deal = PrefetchedDeal & { passRisks?: PassRisk[] };
const deals = JSON.parse(readFileSync(path.join(process.cwd(), "data", "fixtures", "prefetched.json"), "utf8")) as Deal[];

/** Same pairs every run: first labelable risk, 2 newest Akta news items, 1 company-data section. */
const pairs = deals.flatMap((d) => {
  const risk = d.passRisks?.find((r) => r.riskCode !== "MARKET_SIZE");
  if (!risk) return [];
  const news = d.proofCandidates.filter((c) => c.source === "akta_news").slice(0, 2);
  const section = d.proofCandidates.filter((c) => c.source === "akta_company").slice(0, 1);
  return [...news, ...section].map((c) => ({ d, risk, c }));
});

async function main() {
  const runId = Date.now().toString(36);
  const results = await inBatches(pairs, 10, ({ d, risk, c }, i) =>
    labelProofPoint(risk.riskCode, c, {
      version,
      passDate: d.passDate,
      companyName: d.companyName,
      sessionId: `real-${version}-${runId}-${i}`,
    }),
  );

  let supports = 0;
  let badQuote = 0;
  let undated = 0;
  results.forEach((r, i) => {
    const { d, c } = pairs[i]!;
    if (r.label !== "supports") return;
    supports++;
    const source = [c.title, c.summary, c.fullText].filter(Boolean).join("\n\n");
    const quoteOk = checkQuote(r.quote, source).ok;
    const dated = !!c.publishedDate && c.publishedDate >= d.passDate;
    if (!quoteOk) badQuote++;
    if (!dated) undated++;
    if (!quoteOk || !dated)
      console.log(`  ${d.companyName} [${c.sourceName}]${dated ? "" : " undated or before pass"}${quoteOk ? "" : `, quote not in source: "${r.quote.slice(0, 100)}"`}`);
  });
  console.log(
    `\nlabeler-${version} on ${pairs.length} real pairs: ${supports} supports, ${badQuote} break the quote rule, ${undated} break the date rule`,
  );
}

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    try {
      for (const line of readFileSync(path.join(process.cwd(), file), "utf8").split(/\r?\n/)) {
        const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
        if (m && process.env[m[1]!] === undefined) process.env[m[1]!] = m[2]!.trim();
      }
    } catch {
      /* no such file */
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
