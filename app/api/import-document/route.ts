import { NextResponse } from "next/server";
import { rowsFromCsv } from "../../../lib/passlog/csv";

export const dynamic = "force-dynamic";

/** Matches the build plan's document limit. */
const MAX_BYTES = 10 * 1024 * 1024;

/**
 * POST /api/import-document  multipart/form-data { file } -> { rows: PassLogRow[], skipped, errors }
 * Backup path to Affinity. CSV goes straight through rowsFromCsv (no model call). Other formats:
 * lib/documents.ts extracts text (PDF, Word, Excel, email), then C's Prompt 0 returns the rows.
 */
export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Attach a file." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Files can be up to 10 MB." }, { status: 413 });

  if (/\.csv$/i.test(file.name) || file.type === "text/csv") {
    const result = rowsFromCsv(await file.text());
    if (result.rows.length === 0 && result.errors.length > 0) {
      return NextResponse.json({ error: result.errors.join(" "), ...result }, { status: 422 });
    }
    return NextResponse.json(result);
  }
  return NextResponse.json({ error: "Only CSV works so far. PDF, Word and Excel are coming (waiting on Prompt 0)." }, { status: 501 });
}
