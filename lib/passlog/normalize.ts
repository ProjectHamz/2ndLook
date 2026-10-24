/** "https://www.Acme.com/about" -> "acme.com" */
export function normalizeDomain(input: string | null | undefined): string {
  if (!input) return "";
  let d = input.trim().toLowerCase();
  d = d.replace(/^[a-z]+:\/\//, "");
  d = d.replace(/^www\./, "");
  d = d.split(/[/?#]/)[0] ?? "";
  return d;
}

/** Accepts "2025-03-14", "2025-03-14T00:00:00Z", "3/14/2025". Returns "YYYY-MM-DD" or "" if unparseable. */
export function normalizeDate(input: string | null | undefined): string {
  if (!input) return "";
  const s = input.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (us) return `${us[3]}-${us[1]!.padStart(2, "0")}-${us[2]!.padStart(2, "0")}`;
  const t = Date.parse(s);
  if (Number.isNaN(t)) return "";
  return new Date(t).toISOString().slice(0, 10);
}
