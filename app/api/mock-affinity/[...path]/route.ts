/**
 * Fake Affinity API v2 over HTTP, serving the synthetic demo workspace.
 * Try:  curl -H "Authorization: Bearer demo" http://localhost:3000/api/mock-affinity/v2/lists
 *       curl -H "Authorization: Bearer demo" "http://localhost:3000/api/mock-affinity/v2/lists/101/list-entries?fieldTypes=list"
 * The app itself calls the fake in-process (see demoTransport); this route is for poking at it.
 */
import { NextResponse } from "next/server";
import { handleMockAffinity } from "../../../../lib/affinity/mock-server";

export const dynamic = "force-dynamic";

const PREFIX = "/api/mock-affinity";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const inner = new URL(url.pathname.slice(PREFIX.length) + url.search, url.origin);
  const { status, body } = handleMockAffinity(inner, req.headers.get("authorization"), url.origin + PREFIX);
  return NextResponse.json(body, { status });
}
