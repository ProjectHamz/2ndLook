import { NextResponse } from "next/server";
import { getDeal } from "../../../../lib/deals";

export const dynamic = "force-dynamic";

/**
 * POST /api/note/[id] -> { subject, body }
 * Re-engagement note (anti_portfolio) or outbound note (comp) from C's Prompt 4.
 * Leads with the founder's progress; never restates the pass reason.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const result = await getDeal((await params).id);
  if (!result) return NextResponse.json({ error: "Deal not found." }, { status: 404 });
  return NextResponse.json({ error: "Note drafting isn't wired up yet (waiting on Prompt 4)." }, { status: 501 });
}
