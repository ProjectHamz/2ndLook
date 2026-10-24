/**
 * PRISM challenge runner (C). Runs the labeler on the fixed test set and traces every call.
 *
 *   npx tsx scripts/run-labeler.ts v1 3     # 3 passes x 20 items = 60 traces under labeler-v1
 *   npx tsx scripts/run-labeler.ts v2 3
 *   npx tsx scripts/run-labeler.ts v1 1 fast   # same, on the cheaper model (MODELS.fast)
 *
 * Prints accuracy against the hand labels and how many "supports" labels carry a quote
 * that is not word for word in the source (the PRISM rule). Always calls the model fresh.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { MODELS } from "../lib/nicrron";
import { inBatches, labelProofPoint, type LabelCandidate, type LabelerVersion } from "../lib/ai/labeler";
import { checkQuote } from "../lib/quoteCheck";
import type { ProofLabel, RiskCode } from "../lib/types";

type Item = { id: string; company: string; passDate: string; riskCode: RiskCode; expected: ProofLabel; trap?: boolean; candidate: LabelCandidate };

process.env.NICRRON_NO_CACHE = "1";
loadEnv();

const version = (process.argv[2] ?? "v1") as LabelerVersion;
const passes = Number(process.argv[3] ?? 1);
const model = process.argv[4] === "fast" ? MODELS.fast : MODELS.reasoning;
if (version !== "v1" && version !== "v2") throw new Error("Usage: run-labeler.ts v1|v2 [passes]");

const { items } = JSON.parse(readFileSync(path.join(process.cwd(), "data", "labeler-testset.json"), "utf8")) as { items: Item[] };

async function main() {
  const runId = Date.now().toString(36);
  let correct = 0;
  let total = 0;
  let quoteViolations = 0;
  for (let p = 0; p < passes; p++) {
    const results = await inBatches(items, 10, (it) =>
      labelProofPoint(it.riskCode, it.candidate, {
        version,
        passDate: it.passDate,
        companyName: it.company,
        sessionId: `testset-${version}-${runId}-${p}-${it.id}`,
        model,
      }),
    );
    results.forEach((r, i) => {
      const it = items[i]!;
      const source = [it.candidate.title, it.candidate.summary, it.candidate.fullText].join("\n\n");
      const badQuote = r.label === "supports" && !checkQuote(r.quote, source).ok;
      total++;
      if (r.label === it.expected) correct++;
      if (badQuote) quoteViolations++;
      if (r.label !== it.expected || badQuote)
        console.log(`  pass ${p + 1} ${it.id}${it.trap ? " (trap)" : ""}: expected ${it.expected}, got ${r.label}${badQuote ? `, quote not in source: "${r.quote.slice(0, 90)}"` : ""}${r.rejected ? ` [${r.rejected}]` : ""}`);
    });
    console.log(`labeler-${version} pass ${p + 1}/${passes} done`);
  }
  console.log(`\nlabeler-${version} (${model}): ${correct}/${total} match hand labels, ${quoteViolations} supports label(s) with a quote not found in the source`);
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
