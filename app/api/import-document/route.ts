import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Matches the build plan's document limit. */
const MAX_BYTES = 10 * 1024 * 1024;

/**
 * POST /api/import-document  multipart/form-data { file } -> { deals: PassedDeal[] }
 * Backup path to Affinity: lib/documents.ts extracts text (PDF, Word, Excel, CSV, email),
 * then C's Prompt 0 turns it into pass ledger rows.
 */
export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Attach a file." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Files can be up to 10 MB." }, { status: 413 });
  return NextResponse.json({ error: "Document import isn't wired up yet (waiting on Prompt 0)." }, { status: 501 });
}
