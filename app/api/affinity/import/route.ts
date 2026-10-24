import { NextResponse } from "next/server";
import { z } from "zod";
import { importPassedCompanies, transportFromEnv } from "../../../../lib/affinity/client";
import { DEMO_FUND_ID } from "../../../../lib/affinity/demo-workspace";
import { newTrackerToken, toPassedDeal } from "../../../../lib/affinity/write-back";
import { affinityErrorResponse } from "../../../../lib/affinity/http";

export const dynamic = "force-dynamic";

const Body = z.object({ listId: z.coerce.number().int(), fundId: z.string().min(1).optional() });

/**
 * POST /api/affinity/import  { listId, fundId? }
 * -> { mode, listName, deals: (PassedDeal & { trackerToken })[], skipped, notPassedCount }
 * Pass risks are parsed by C's Prompt 1 during prefetch; the demo reads them from fixtures.
 */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Body must be JSON: { listId }" }, { status: 400 });
  const t = transportFromEnv();
  try {
    const result = await importPassedCompanies(t, parsed.data.listId, { fundId: parsed.data.fundId ?? DEMO_FUND_ID });
    return NextResponse.json({
      mode: result.mode,
      listName: result.listName,
      deals: result.rows.map((r) => ({ ...toPassedDeal(r), trackerToken: newTrackerToken() })),
      skipped: result.skipped,
      notPassedCount: result.notPassedCount,
    });
  } catch (e) {
    return affinityErrorResponse(e);
  }
}
