/**
 * Roundtable (sponsor): a shared workspace where AI agents store and read files.
 * 2ndLook files each approved re-engagement memo there, so the fund's other agents can
 * pick up the follow-up. SERVER ONLY: reads ROUNDTABLE_API_KEY.
 *
 * Tools are plain HTTPS calls: POST https://roundtable.bot/api/tools/<name>, Bearer key,
 * JSON body. Writes need a request_id; resending the same one returns the stored result.
 */
import { createHash } from "node:crypto";
import type { CompanyResult } from "./secondlook/engine";
import { OBJECTION_LABEL, SOURCE_LABEL, VERDICT_LABEL } from "./secondlook/types";

const BASE_URL = (process.env.ROUNDTABLE_URL || "https://roundtable.bot").replace(/\/+$/, "");

export type ToolResult = { ok: true; data: unknown } | { ok: false; error: string };

/** Never throws: a Roundtable outage must not block an approval. */
export async function callTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
  const key = process.env.ROUNDTABLE_API_KEY;
  if (!key) return { ok: false, error: "Roundtable isn't configured (ROUNDTABLE_API_KEY)." };
  try {
    const res = await fetch(`${BASE_URL}/api/tools/${name}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(args),
      signal: AbortSignal.timeout(10_000),
    });
    const text = await res.text();
    if (!res.ok) return { ok: false, error: `Roundtable ${res.status}: ${text.slice(0, 200)}` };
    return { ok: true, data: text ? JSON.parse(text) : null };
  } catch (e) {
    return { ok: false, error: `Couldn't reach Roundtable: ${e instanceof Error ? e.message : String(e)}` };
  }
}

export type ApprovedNote = { subject: string; body: string; owner: string; due: string };

export function memoPath(companyId: string): string {
  return `re-engage/${companyId}.md`;
}

/** The re-underwrite memo as Markdown: why we passed, what changed (with quotes), what we're doing. */
export function memoMarkdown(r: CompanyResult, note: ApprovedNote, approvedOn: string): string {
  const c = r.company;
  const risks = r.objections.map((o) => `- ${OBJECTION_LABEL[o.code]}: ${VERDICT_LABEL[o.verdict]}`).join("\n");
  const proof = r.objections
    .flatMap((o) => o.evidence.map((e) => ({ ...e, risk: o.code })))
    .filter((e) => e.llm_label === "supports")
    .sort((a, b) => b.published_date.localeCompare(a.published_date))
    .map((e) => `- ${e.published_date}, ${SOURCE_LABEL[e.source] ?? e.source} (${OBJECTION_LABEL[e.risk]}): "${e.quote}" ${e.url}`)
    .join("\n");
  return `# Re-engage: ${c.name}

Approved ${approvedOn}. Deal lead: ${note.owner}. Reach out by ${note.due}.
Website: https://${c.domain}

## Why we passed
${c.partner}, ${c.pass_date}: "${c.pass_reason_text}"

## Pass risks now
${risks || "- None recorded"}

## What changed (verified quotes)
${proof || "- No supporting proof points yet."}

## Approved note
Subject: ${note.subject}

${note.body}

---
Filed by 2ndLook. Conviction ${r.score}/100. Statuses are set by fixed rules; every quote was checked word for word against its source.
`;
}

export async function fileReEngagementMemo(r: CompanyResult, note: ApprovedNote): Promise<ToolResult & { path: string }> {
  const path = memoPath(r.company.id);
  const content = memoMarkdown(r, note, new Date().toISOString().slice(0, 10));
  const request_id = `memo-${createHash("sha256").update(path + content).digest("hex").slice(0, 32)}`;
  const res = await callTool("write_file", { path, content, message: `Re-engage ${r.company.name}`, request_id });
  return { ...res, path };
}
