import { NextResponse } from "next/server";
import {
  AffinityError,
  importPassedCompanies,
  listCompanyLists,
  transportFromEnv,
} from "../../../../lib/affinity/client";
import { DEMO_FUND_ID } from "../../../../lib/affinity/demo-workspace";

export const dynamic = "force-dynamic";

/** GET /api/import/affinity -> { mode, lists: [{ id, name }] } */
export async function GET() {
  const t = transportFromEnv();
  try {
    const lists = await listCompanyLists(t);
    return NextResponse.json({ mode: t.mode, lists });
  } catch (e) {
    return errorResponse(e);
  }
}

/** POST /api/import/affinity  { listId: number, fundId?: string } -> AffinityImportResult */
export async function POST(req: Request) {
  const t = transportFromEnv();
  let body: { listId?: unknown; fundId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON: { listId }" }, { status: 400 });
  }
  const listId = Number(body.listId);
  if (!Number.isInteger(listId)) return NextResponse.json({ error: "listId must be a number" }, { status: 400 });
  const fundId = typeof body.fundId === "string" && body.fundId ? body.fundId : DEMO_FUND_ID;
  try {
    const result = await importPassedCompanies(t, listId, { fundId });
    return NextResponse.json(result);
  } catch (e) {
    return errorResponse(e);
  }
}

function errorResponse(e: unknown) {
  if (e instanceof AffinityError) {
    return NextResponse.json({ error: e.message }, { status: e.status >= 500 ? 502 : e.status });
  }
  console.error(e);
  return NextResponse.json({ error: "Couldn't reach Affinity." }, { status: 502 });
}
