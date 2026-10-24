/**
 * Prints SQL that loads lib/secondlook/sample-data.ts into Supabase (funds, companies, evidence).
 * Re-runnable: it replaces every row with the current sample data in one transaction.
 *
 *   npx tsx scripts/seed-sample-data.ts | psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1
 *
 * SUPABASE_DB_URL is the direct postgresql:// connection string (Supabase > Connect).
 */
import { COMPANIES, FUNDS } from "../lib/secondlook/sample-data";

type Value = string | number | boolean | null | undefined | string[];

function sql(v: Value): string {
  if (v === null || v === undefined) return "null";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number") return String(v);
  if (Array.isArray(v)) return `array[${v.map(sql).join(", ")}]::text[]`;
  return `'${v.replace(/'/g, "''")}'`;
}

function insert(table: string, rows: Record<string, Value>[]): string {
  if (rows.length === 0) return "";
  const cols = Object.keys(rows[0]!);
  const values = rows.map((r) => `  (${cols.map((c) => sql(r[c])).join(", ")})`).join(",\n");
  return `insert into ${table} (${cols.join(", ")}) values\n${values};\n`;
}

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
