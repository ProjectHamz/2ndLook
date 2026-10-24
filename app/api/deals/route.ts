import { NextResponse } from "next/server";
import { getDeals } from "../../../lib/deals";

export const dynamic = "force-dynamic";

/** GET /api/deals?view=anti_portfolio|comp -> DealResult[] ranked by conviction */
export async function GET(req: Request) {
  const view = new URL(req.url).searchParams.get("view") ?? "anti_portfolio";
  if (view !== "anti_portfolio" && view !== "comp") {
    return NextResponse.json({ error: "view must be anti_portfolio or comp" }, { status: 400 });
  }
  try {
    return NextResponse.json(await getDeals(view));
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Couldn't load deals." }, { status: 500 });
  }
}
