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
  companyName: string;
  domain: string;
};

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** RFC 5545 text: escape \ ; , and newlines. */
function icsText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** A 30-minute call at 10:00 (the viewer's local time) on the reach-out date, as an .ics file. */
function meetingIcs(p: { companyName: string; domain: string; owner: string; due: string; subject: string }): string {
  const day = p.due.replace(/-/g, "");
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//2ndLook//Re-engagement//EN",
    "BEGIN:VEVENT",
    `UID:${p.domain}-${day}@2ndlook`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${day}T100000`,
    `DTEND:${day}T103000`,
    `SUMMARY:${icsText(`Catch up with ${p.companyName}`)}`,
    `DESCRIPTION:${icsText(`Re-engagement call. Deal lead: ${p.owner}.\nNote: ${p.subject}\nhttps://${p.domain}`)}`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
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
  const [calendarSaved, setCalendarSaved] = useState(false);

  const onAddToCalendar = () => {
    const ics = meetingIcs({ companyName: p.companyName, domain: p.domain, owner, due, subject });
    const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `catch-up-${p.companyName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.ics`;
    a.click();
    URL.revokeObjectURL(url);
    setCalendarSaved(true);
    setTimeout(() => setCalendarSaved(false), 3000);
  };

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
        <button
          onClick={onAddToCalendar}
          className="border border-ink px-5 py-3 text-[14px] font-medium text-ink transition-colors hover:bg-linen"
        >
          {calendarSaved ? "Calendar file downloaded" : "Add meeting to calendar"}
        </button>
        <p className="text-[12px] leading-5 text-muted">
          Approving sets the Affinity status to Re-engage and files the memo to the fund&apos;s Roundtable workspace. No email is sent.
        </p>
      </div>
    </div>
  );
}
