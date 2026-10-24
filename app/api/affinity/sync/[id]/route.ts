import { NextResponse } from "next/server";
import { z } from "zod";
import { syncToAffinity } from "../../../../../lib/affinity/write-back";
import { getDeal } from "../../../../../lib/deals";
import { affinityErrorResponse } from "../../../../../lib/affinity/http";

export const dynamic = "force-dynamic";

const Body = z.object({ action: z.enum(["re_engage", "add_comp"]).default("re_engage") });

/**
 * POST /api/affinity/sync/[id]  { action?: "re_engage" | "add_comp" }
 * -> { mode, field, value, message }  e.g. message "Affinity status set to Re-engage"
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const parsed = Body.safeParse((await req.json().catch(() => ({}))) ?? {});
  if (!parsed.success) return NextResponse.json({ error: "action must be re_engage or add_comp" }, { status: 400 });
  const result = await getDeal((await params).id);
  if (!result) return NextResponse.json({ error: "Deal not found." }, { status: 404 });
  try {
    return NextResponse.json(await syncToAffinity(result, parsed.data.action));
  } catch (e) {
    return affinityErrorResponse(e);
  }
}
