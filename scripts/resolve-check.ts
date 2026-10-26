/**
 * Resolve every ledger domain to an Akta company uuid — Part B diagnostic.
 *
 *   npx tsx scripts/resolve-check.ts
 *
 * Company Search is FREE (it does not consume akta.pro credits), so this is the
 * cheapest way to see which of the 30 deals Akta can find at all, and to catch
 * same-name mismatches, before spending credits on news or enrichment.
 */
import { promises as fs } from "node:fs";
import path from "node:path";

import { rowsFromCsv } from "../lib/passlog/csv";
import { resolveCompany } from "../lib/akta";

const ROOT = process.cwd();

async function main() {
  await loadEnv();
  if (!process.env.AKTA_API_KEY) {
    console.error("[resolve] AKTA_API_KEY is not set (.env.local or .env).");
    process.exit(1);
  }

  const csv = await fs.readFile(path.join(ROOT, "data", "pass-ledger.csv"), "utf8");
  const { rows } = rowsFromCsv(csv, "harbor_street");

  const found: string[] = [];
  const missing: string[] = [];

  for (const r of rows) {
    const res = await resolveCompany(r.domain);
    if (res.reason) {
      missing.push(`${r.company_name} (${r.domain}) -> ${res.reason}`);
      console.log(`  MISS  ${r.company_name.padEnd(18)} ${r.domain.padEnd(22)} ${res.reason}`);
    } else {
      found.push(`${r.company_name}=${res.data.id}`);
      console.log(`  ok    ${r.company_name.padEnd(18)} ${r.domain.padEnd(22)} ${res.data.id}  "${res.data.name}"`);
    }
  }

  console.log(`\n[resolve] ${found.length}/${rows.length} resolved, ${missing.length} missing.`);
  if (missing.length) {
    console.log("[resolve] missing:");
    for (const m of missing) console.log("   -", m);
    console.log("[resolve] a missing domain means Akta has no company with that exact website,");
    console.log("[resolve] so that deal can never get Akta proof. Swap the domain or the company.");
  }
}

async function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    try {
      const text = await fs.readFile(path.join(ROOT, file), "utf8");
      for (const line of text.split(/\r?\n/)) {
        const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
        if (!m) continue;
        const key = m[1]!;
        let val = m[2]!.trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
        if (process.env[key] === undefined) process.env[key] = val;
      }
    } catch {
      /* no such file */
    }
  }
}

main().catch((e) => {
  console.error("[resolve] fatal:", e);
  process.exit(1);
});
