/**
 * Drafts the re-engagement note (Prompt 4) for every company in the default fund, so the
 * memo page reads each note from the response cache (data/fixtures/llm/) instead of waiting
 * on the model. Run locally after the data changes, then commit data/fixtures/llm.
 *
 *   npx tsx scripts/warm-notes.ts
 */
import { readFileSync } from "node:fs";
import path from "node:path";

loadEnv();

async function main() {
  // Imported after loadEnv so Supabase and Nicrron see the keys.
  const { getFund, getRanked } = await import("../lib/secondlook/data");
  const { draftNoteForCompany } = await import("../lib/ai/notes");
  const { inBatches } = await import("../lib/ai/labeler");

  const fund = await getFund();
  const ranked = await getRanked(fund.id);
  const thesis = { fundName: fund.name, sectors: fund.sectors, stages: fund.stages, keywords: fund.keywords };
  let failed = 0;
  await inBatches(ranked, 6, async (r) => {
    try {
      const note = await draftNoteForCompany(r, { dealLead: r.company.partner, thesis });
      console.log(`${r.company.name.padEnd(18)} ${note.body.split(/\s+/).length} words: ${note.subject}`);
    } catch (e) {
      failed++;
      console.warn(`${r.company.name}: ${e instanceof Error ? e.message : e}`);
    }
  });
  console.log(`\n${ranked.length - failed}/${ranked.length} notes cached for ${fund.name}`);
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
