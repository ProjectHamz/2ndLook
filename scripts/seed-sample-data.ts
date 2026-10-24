/**
 * Prints SQL that loads lib/secondlook/sample-data.ts into Supabase (funds, companies, evidence).
 * Re-runnable: it replaces every row with the current sample data in one transaction.
 *
 *   npx tsx scripts/seed-sample-data.ts | psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1
 *
 * SUPABASE_DB_URL is the direct postgresql:// connection string (Supabase > Connect).
 */
import { COMPANIES, FUNDS } from "../lib/secondlook/sample-data";
import { insert } from "./sql";

const out = [
  "begin;",
  "delete from evidence;",
  "delete from companies;",
  "delete from funds;",
  insert(
    "funds",
    FUNDS.map((f) => ({ ...f })),
  ),
  insert(
    "companies",
    COMPANIES.map(({ evidence: _evidence, ...c }) => ({ ...c })),
  ),
  insert(
    "evidence",
    COMPANIES.flatMap((c) => c.evidence.map((e) => ({ company_id: c.id, ...e, amount_usd: e.amount_usd ?? null }))),
  ),
  "commit;",
];

console.log(out.join("\n"));
