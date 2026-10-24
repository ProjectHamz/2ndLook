"use client";

import { useState, useTransition } from "react";
import { useAppState } from "./AppState";
import { approveReEngagement } from "../app/brief/[id]/actions";

type Props = {
  companyId: string;
  to: string;
  defaultOwner: string;
  owners: string[];
  subject: string;
  body: string;
  canEmail: boolean;
  today: string;
  fundId?: string;
};

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function EmailApproval(p: Props) {
  const { approvals, approve, undoApproval } = useAppState();
  const existing = approvals.find((a) => a.companyId === p.companyId);
  const [owner, setOwner] = useState(p.defaultOwner);
  const [due, setDue] = useState(addDays(p.today, 7));
  const [subject, setSubject] = useState(p.subject);
  const [body, setBody] = useState(p.body);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const onApprove = () =>
    startTransition(async () => {
      setResult(null);
      const res = await approveReEngagement(p.companyId, { subject, body, owner, due }, p.fundId);
      setResult(res);
      approve({ companyId: p.companyId, owner, due });
    });

  const field = "w-full border border-rule bg-paper px-3 py-2 text-[15px] outline-none focus:border-pine";

  return (
    <div className="grid gap-10 py-8 md:grid-cols-[1.6fr_1fr]">
      <div className="flex flex-col gap-4">
        {!p.canEmail ? (
          <p className="border border-rule bg-linen px-4 py-3 text-[14px] text-graphite">
            No objection is resolved yet, so this draft is a light check-in rather than a revisit.
          </p>
        ) : null}
        <label className="flex flex-col gap-1 text-[13px] text-graphite">
          To
          <input className={field} value={p.to} readOnly />
        </label>
        <label className="flex flex-col gap-1 text-[13px] text-graphite">
          Subject
          <input className={field} value={subject} onChange={(e) => setSubject(e.target.value)} disabled={Boolean(existing)} />
        </label>
        <label className="flex flex-col gap-1 text-[13px] text-graphite">
          Message
          <textarea
            className={`${field} min-h-[400px] leading-7`}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            disabled={Boolean(existing)}
          />
        </label>
      </div>

      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-[13px] text-graphite">
          Owner
          <select className={field} value={owner} onChange={(e) => setOwner(e.target.value)} disabled={Boolean(existing)}>
            {p.owners.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[13px] text-graphite">
          Reach out by
          <input
            type="date"
            className={`${field} num`}
            value={due}
            onChange={(e) => setDue(e.target.value)}
            disabled={Boolean(existing)}
          />
        </label>

        {existing ? (
          <div className="border border-pine px-4 py-4">
            <p className="text-[15px] font-medium text-pine">Approved</p>
            <p className="num mt-1 text-[14px] text-graphite">
              {existing.owner} reaches out by {existing.due}. Logged {new Date(existing.approvedAt).toLocaleString()}.
            </p>
            {result ? (
              <p role="status" className={`mt-2 text-[13px] leading-5 ${result.ok ? "text-pine" : "text-graphite"}`}>
                {result.message}
              </p>
            ) : null}
            <button onClick={() => undoApproval(p.companyId)} className="mt-3 text-[13px] text-graphite underline">
              Undo
            </button>
          </div>
        ) : (
          <button
            onClick={onApprove}
            disabled={pending}
            className="bg-pine px-5 py-3 text-[14px] font-medium text-white transition-colors hover:bg-ink disabled:opacity-60"
          >
            {pending ? "Approving…" : `Approve and assign to ${owner.split(" ")[0]}`}
          </button>
        )}
        <p className="text-[12px] leading-5 text-muted">
          Approving sets the Affinity status to Re-engage and files the memo to the fund&apos;s Roundtable workspace. No email is sent.
        </p>
      </div>
    </div>
  );
}
