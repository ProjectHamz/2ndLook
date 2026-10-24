/**
 * Affinity write-back and the PassLogRow -> PassedDeal mapping. SERVER ONLY.
 *
 * Every write is logged to affinity_sync_log so the UI can show "Affinity status set to Re-engage".
 * Demo mode stops there. Live mode also calls Affinity v2, which needs these env vars:
 *   AFFINITY_LIST_ID, AFFINITY_STATUS_FIELD_ID, AFFINITY_REENGAGE_OPTION_ID
 * The live request body follows the v2 docs; verify it against a sandbox before relying on it.
 */
import { customAlphabet } from "nanoid";
import { logAffinitySync } from "../store";
import type { PassLogRow } from "../passlog/types";
import type { PassedDeal } from "../types";
import { AffinityError, transportFromEnv } from "./client";
import type { AffinityFieldValue } from "./types";

/** 12 characters, no lookalikes. Tracker links are /t/<token>. */
export const newTrackerToken = customAlphabet("23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz", 12);

/** "Acme AI" + "acme.ai" -> "acme-ai" (domain first, so it stays stable if the name is edited). */
export function dealIdFor(row: Pick<PassLogRow, "company_name" | "domain">): string {
  const base = row.domain || row.company_name;
  return base.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export function toPassedDeal(row: PassLogRow): PassedDeal {
  const entryId = row.source === "affinity" && row.source_ref ? Number(row.source_ref) : NaN;
  return {
    dealId: dealIdFor(row),
    ...(Number.isInteger(entryId) ? { affinityEntryId: entryId } : {}),
    companyName: row.company_name,
    domain: row.domain,
    passDate: row.pass_date,
    partnerName: row.partner,
    stageAtPass: row.stage_at_pass,
    sector: row.sector,
    passReasonText: row.pass_reason_text,
  };
}

/** POST /v2/lists/{listId}/list-entries/{listEntryId}/fields/{fieldId} */
async function updateListEntryField(
  apiKey: string,
  listId: string,
  entryId: number,
  fieldId: string,
  value: AffinityFieldValue,
): Promise<void> {
  const res = await fetch(`https://api.affinity.co/v2/lists/${listId}/list-entries/${entryId}/fields/${fieldId}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ value }),
    cache: "no-store",
  });
  if (!res.ok) throw new AffinityError(res.status, `Affinity write-back failed (${res.status}).`);
}

export type SyncAction = "re_engage" | "add_comp";

export type SyncResult = { mode: "live" | "demo"; field: string; value: string; message: string };

export async function syncToAffinity(deal: PassedDeal, action: SyncAction): Promise<SyncResult> {
  const mode = transportFromEnv().mode;
  const field = action === "re_engage" ? "Status" : "List entry";
  const value = action === "re_engage" ? "Re-engage" : "Added to Deal Pipeline";

  if (mode === "live") {
    if (action === "add_comp") throw new AffinityError(501, "Adding comps to a live Affinity list isn't supported yet.");
    const { AFFINITY_API_KEY, AFFINITY_LIST_ID, AFFINITY_STATUS_FIELD_ID, AFFINITY_REENGAGE_OPTION_ID } = process.env;
    if (!AFFINITY_LIST_ID || !AFFINITY_STATUS_FIELD_ID || !AFFINITY_REENGAGE_OPTION_ID) {
      throw new AffinityError(501, "Live write-back needs AFFINITY_LIST_ID, AFFINITY_STATUS_FIELD_ID and AFFINITY_REENGAGE_OPTION_ID.");
    }
    if (!deal.affinityEntryId) throw new AffinityError(422, "This deal didn't come from Affinity, so there's nothing to update.");
    await updateListEntryField(AFFINITY_API_KEY!, AFFINITY_LIST_ID, deal.affinityEntryId, AFFINITY_STATUS_FIELD_ID, {
      type: "ranked-dropdown",
      data: { dropdownOptionId: Number(AFFINITY_REENGAGE_OPTION_ID) },
    });
  }

  await logAffinitySync({ deal_id: deal.dealId, field, value });
  const message = action === "re_engage" ? "Affinity status set to Re-engage" : "Added to your Affinity pipeline";
  return { mode, field, value, message };
}
