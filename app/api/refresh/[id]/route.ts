import { NextResponse } from "next/server";
import { getDeal } from "../../../../lib/deals";

export const dynamic = "force-dynamic";

/**
 * POST /api/refresh/[id] -> { live: boolean, result: DealResult }
 * "Check again". Will re-run Akta + labeling for this one deal (B's and C's clients);
 * until then, and whenever the live check fails, it returns the fixture with live: false.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const result = await getDeal((await params).id);
  if (!result) return NextResponse.json({ error: "Deal not found." }, { status: 404 });
  return NextResponse.json({ live: false, result });
}
