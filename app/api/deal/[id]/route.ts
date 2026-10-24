import { NextResponse } from "next/server";
import { z } from "zod";
import { getDeal } from "../../../../lib/deals";
import { setDealLead } from "../../../../lib/store";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/deal/[id] -> DealResult (full memo data) */
export async function GET(_req: Request, { params }: Ctx) {
  const deal = await getDeal((await params).id);
  if (!deal) return NextResponse.json({ error: "Deal not found." }, { status: 404 });
  return NextResponse.json(deal);
}

const LeadBody = z.object({
  dealLead: z.string().trim().min(1),
  followUpDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
});

/** POST /api/deal/[id]  { dealLead, followUpDate? } -> assigns a deal lead, returns the updated DealResult */
export async function POST(req: Request, { params }: Ctx) {
  const id = (await params).id;
  const parsed = LeadBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Body must be { dealLead, followUpDate?: YYYY-MM-DD }" }, { status: 400 });
  }
  if (!(await getDeal(id))) return NextResponse.json({ error: "Deal not found." }, { status: 404 });
  await setDealLead({ deal_id: id, deal_lead: parsed.data.dealLead, follow_up_date: parsed.data.followUpDate ?? null });
  return NextResponse.json(await getDeal(id));
}
