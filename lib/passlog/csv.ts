import { PASS_LOG_COLUMNS, type PassLogRow, type SkippedRow } from "./types";
import { normalizeDate, normalizeDomain } from "./normalize";

/** Small RFC 4180 style parser: quoted fields, escaped quotes (""), commas and newlines inside quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const src = text.replace(/^﻿/, "");

  for (let i = 0; i < src.length; i++) {
    const c = src[i]!;
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') inQuotes = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((v) => v.trim() !== ""));
}

export type CsvImportResult = {
  rows: PassLogRow[];
  skipped: SkippedRow[];
  /** Problems with the file itself, e.g. missing columns. */
  errors: string[];
};

/** Turns a pass-log CSV (columns in PASS_LOG_COLUMNS; extra columns ignored) into rows. */
export function rowsFromCsv(text: string, defaultFundId = "fund_a"): CsvImportResult {
  const table = parseCsv(text);
  if (table.length === 0) return { rows: [], skipped: [], errors: ["The file is empty."] };

  const header = table[0]!.map((h) => h.trim().toLowerCase());
  const col = (name: string) => header.indexOf(name);
  const required = ["company_name", "pass_date", "pass_reason_text"];
  const missing = required.filter((r) => col(r) === -1);
  if (missing.length) {
    return {
      rows: [],
      skipped: [],
      errors: [`Missing column(s): ${missing.join(", ")}. Expected: ${PASS_LOG_COLUMNS.join(", ")}.`],
    };
  }

  const rows: PassLogRow[] = [];
  const skipped: SkippedRow[] = [];
  for (const r of table.slice(1)) {
    const get = (name: string) => {
      const i = col(name);
      return i === -1 ? "" : (r[i] ?? "").trim();
    };
    const company_name = get("company_name");
    if (!company_name) continue;
    const pass_date = normalizeDate(get("pass_date"));
    const pass_reason_text = get("pass_reason_text");
    if (!pass_reason_text) {
      skipped.push({ company_name, why: "No pass reason recorded" });
      continue;
    }
    if (!pass_date) {
      skipped.push({ company_name, why: "No readable pass date" });
      continue;
    }
    rows.push({
      company_name,
      domain: normalizeDomain(get("domain")),
      pass_date,
      partner: get("partner"),
      stage_at_pass: get("stage_at_pass"),
      sector: get("sector"),
      pass_reason_text,
      fund_id: get("fund_id") || defaultFundId,
      source: "csv",
    });
  }
  return { rows, skipped, errors: [] };
}
