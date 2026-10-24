/** Tiny SQL literal builders for the seed scripts (output is piped to psql). */
export type Value = string | number | boolean | null | undefined | string[];

export function sql(v: Value): string {
  if (v === null || v === undefined) return "null";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number") return String(v);
  if (Array.isArray(v)) return `array[${v.map(sql).join(", ")}]::text[]`;
  return `'${v.replace(/'/g, "''")}'`;
}

export function insert(table: string, rows: Record<string, Value>[]): string {
  if (rows.length === 0) return "";
  const cols = Object.keys(rows[0]!);
  const values = rows.map((r) => `  (${cols.map((c) => sql(r[c])).join(", ")})`).join(",\n");
  return `insert into ${table} (${cols.join(", ")}) values\n${values};\n`;
}
