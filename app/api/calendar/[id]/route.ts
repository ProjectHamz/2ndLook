import { NextResponse } from "next/server";
import { followUpIcs } from "../../../../lib/calendar";
import { getDeal } from "../../../../lib/deals";

export const dynamic = "force-dynamic";

/** GET /api/calendar/[id] -> .ics download for the deal's follow-up date (default: two weeks out) */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const deal = await getDeal((await params).id);
  if (!deal) return NextResponse.json({ error: "Deal not found." }, { status: 404 });
  return new Response(followUpIcs(deal), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="follow-up-${deal.dealId}.ics"`,
    },
  });
}
