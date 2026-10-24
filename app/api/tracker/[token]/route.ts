import { NextResponse } from "next/server";
import { z } from "zod";
import { getDealByToken } from "../../../../lib/deals";

export const dynamic = "force-dynamic";

const Body = z.object({
  milestone: z.string().min(1),
  url: z.string().url(),
  /** Roundtable session id from the page's script. */
  roundtableSessionId: z.string().min(1),
});

/**
 * POST /api/tracker/[token]  { milestone, url, roundtableSessionId } -> { accepted: true } | { error }
 * Founder proof: Roundtable risk check, then fetch the page, C's Prompt 2 + quote check,
 * then store in founder_proofs (lib/store.ts addFounderProof). Steps 1-2 land at 1:30.
 */
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const result = await getDealByToken((await params).token);
  if (!result) return NextResponse.json({ error: "This link isn't valid." }, { status: 404 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Send a milestone and a link to your proof." }, { status: 400 });
  if (!result.passRisks.some((r) => r.founderMilestone === parsed.data.milestone)) {
    return NextResponse.json({ error: "That milestone isn't on this tracker." }, { status: 400 });
  }
  return NextResponse.json({ error: "Proof submission isn't wired up yet (Roundtable + proof check)." }, { status: 501 });
}
