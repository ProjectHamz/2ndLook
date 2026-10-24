/**
 * C's Prompt 0: plain text from any document (partner notes, email export, Word, PDF) ->
 * pass ledger rows. D's lib/documents.ts turns the file into text; this reads the text.
 * The pass reason must be copied word for word; rows whose reason isn't in the text are skipped.
 */
import { z } from "zod";
import { chatJson, MODELS } from "../nicrron";
import { normalizeDate, normalizeDomain } from "../passlog/normalize";
import type { PassLogRow, SkippedRow } from "../passlog/types";
import { normalizeForQuote } from "../quoteCheck";

export const EXTRACTOR_AGENT = "ledger-extractor-v1";

/** Keeps one call within the model's context with room to spare. */
const MAX_CHARS = 100_000;

const SYSTEM = `You extract a venture fund's pass ledger from messy notes: every company the fund passed on.
For each company return:
- company_name
- domain: the company's website domain if it appears in the text, else ""
- pass_date: YYYY-MM-DD if a date is given (use the 1st if only month and year are given), else ""
- partner: who passed, else ""
- stage_at_pass: e.g. Seed, Series A, else ""
- sector: short, e.g. "fintech infrastructure", else ""
- pass_reason_text: the reason the fund passed, copied character for character from the text. Do not reword or shorten inside the span.
Include only companies the fund passed on (not active deals or portfolio companies). If a passed company has no stated reason, still include it with pass_reason_text "".
Reply with JSON only: {"rows":[{...}]}`;

const Row = z.object({
  company_name: z.string(),
  domain: z.string().default(""),
  pass_date: z.string().default(""),
  partner: z.string().default(""),
  stage_at_pass: z.string().default(""),
  sector: z.string().default(""),
  pass_reason_text: z.string().default(""),
});
const Schema = z.object({ rows: z.array(Row) });

export type ExtractResult = { rows: PassLogRow[]; skipped: SkippedRow[]; errors: string[] };

export async function extractPassLedger(text: string, opts: { fileName: string; fundId: string }): Promise<ExtractResult> {
  const errors = text.length > MAX_CHARS ? [`Only the first ${MAX_CHARS.toLocaleString()} characters of ${opts.fileName} were read.`] : [];
  const res = await chatJson({
    model: MODELS.reasoning,
    agentId: EXTRACTOR_AGENT,
    sessionId: `extract-${opts.fileName}-${Date.now()}`,
    maxTokens: 16000,
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: `Document: ${opts.fileName}\n\n${text.slice(0, MAX_CHARS)}` },
    ],
    parse: (raw) => Schema.parse(raw),
  });
  if (!res.ok) return { rows: [], skipped: [], errors: [...errors, `Couldn't read ${opts.fileName}. Try a CSV instead.`] };

  const source = normalizeForQuote(text);
  const rows: PassLogRow[] = [];
  const skipped: SkippedRow[] = [];
  for (const r of res.value.rows) {
    const name = r.company_name.trim();
    const reason = r.pass_reason_text.trim();
    if (!name) continue;
    if (!reason) {
      skipped.push({ company_name: name, why: "no pass reason found" });
      continue;
    }
    if (!source.includes(normalizeForQuote(reason))) {
      skipped.push({ company_name: name, why: "pass reason not found word for word in the document" });
      continue;
    }
    rows.push({
      company_name: name,
      domain: normalizeDomain(r.domain),
      pass_date: normalizeDate(r.pass_date),
      partner: r.partner.trim(),
      stage_at_pass: r.stage_at_pass.trim(),
      sector: r.sector.trim(),
      pass_reason_text: reason,
      fund_id: opts.fundId,
      source: "csv",
    });
  }
  return { rows, skipped, errors };
}
