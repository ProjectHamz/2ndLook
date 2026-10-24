import { NextResponse } from "next/server";
import { getDeal, loadThesis } from "../../../../lib/deals";
import { draftNote } from "../../../../lib/prompts";

export const dynamic = "force-dynamic";

/**
 * POST /api/note/[id] -> { subject, body }
 * Re-engagement note (anti_portfolio) or outbound note (comp) from C's Prompt 4.
 * Leads with the founder's progress; never restates the pass reason. Signed by the deal lead.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const result = await getDeal((await params).id);
  if (!result) return NextResponse.json({ error: "Deal not found." }, { status: 404 });
  try {
    const note = await draftNote(result, { dealLead: result.dealLead ?? result.deal.partner, thesis: await loadThesis() });
    return NextResponse.json(note);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Couldn't draft a note." }, { status: 502 });
  }
}
