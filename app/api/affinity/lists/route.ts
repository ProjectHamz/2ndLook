import { NextResponse } from "next/server";
import { detectPassFields, listCompanyLists, listFields, transportFromEnv } from "../../../../lib/affinity/client";
import { affinityErrorResponse } from "../../../../lib/affinity/http";

export const dynamic = "force-dynamic";

/**
 * GET /api/affinity/lists
 * -> { mode, lists: [{ id, name, fields: [{ id, name, valueType }], detected: PassFieldMapping }] }
 * `detected` is our guess at the Status, Pass Reason, Pass Date, ... fields, to preselect in the UI.
 */
export async function GET() {
  const t = transportFromEnv();
  try {
    const lists = await listCompanyLists(t);
    const withFields = await Promise.all(
      lists.map(async (l) => {
        const fields = await listFields(t, l.id);
        return { ...l, fields, detected: detectPassFields(fields) };
      }),
    );
    return NextResponse.json({ mode: t.mode, lists: withFields });
  } catch (e) {
    return affinityErrorResponse(e);
  }
}
