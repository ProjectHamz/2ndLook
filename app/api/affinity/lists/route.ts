import { NextResponse } from "next/server";
import { listCompanyLists, transportFromEnv } from "../../../../lib/affinity/client";
import { affinityErrorResponse } from "../../../../lib/affinity/http";

export const dynamic = "force-dynamic";

/** GET /api/affinity/lists -> { mode, lists: [{ id, name }] } for the import screen's list select */
export async function GET() {
  const t = transportFromEnv();
  try {
    return NextResponse.json({ mode: t.mode, lists: await listCompanyLists(t) });
  } catch (e) {
    return affinityErrorResponse(e);
  }
}

