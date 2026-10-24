"use server";

import { getCompanyResult } from "../../../lib/secondlook/data";
import { fileReEngagementMemo, type ApprovedNote } from "../../../lib/roundtable";
import { logAffinitySync } from "../../../lib/store";

export type ApproveResult = { ok: boolean; message: string };

/**
 * Approve a re-engagement: file the memo to the fund's Roundtable workspace and log the
 * Affinity status change (demo workspace). Each step reports on its own, so one outage
 * doesn't hide the other.
 */
export async function approveReEngagement(companyId: string, note: ApprovedNote, fundId?: string): Promise<ApproveResult> {
  const r = await getCompanyResult(companyId, fundId);
  if (!r) return { ok: false, message: "We couldn't find this company. Reload the page and try again." };

  const [memo, affinity] = await Promise.all([
    fileReEngagementMemo(r, note),
    logAffinitySync({ deal_id: companyId, field: "Status", value: "Re-engage" }).then(
      () => true,
      () => false,
    ),
  ]);

  const parts = [
    affinity ? "Affinity status set to Re-engage." : "Couldn't log the Affinity status.",
    memo.ok ? `Memo filed to Roundtable (${memo.path}).` : `Memo not filed: ${memo.error}`,
  ];
  return { ok: memo.ok && affinity, message: parts.join(" ") };
}
