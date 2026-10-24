import { NextResponse } from "next/server";
import { AffinityError } from "./client";

/** Maps Affinity errors to a JSON response for the API routes (5xx from Affinity become 502). */
export function affinityErrorResponse(e: unknown) {
  if (e instanceof AffinityError) {
    return NextResponse.json({ error: e.message }, { status: e.status >= 500 && e.status !== 501 ? 502 : e.status });
  }
  console.error(e);
  return NextResponse.json({ error: "Couldn't reach Affinity." }, { status: 502 });
}
