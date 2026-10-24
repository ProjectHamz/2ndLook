/** A one-event .ics file for the follow-up date, so partners can add it without a calendar sign-in. */
import type { DealResult } from "./types";

const FOLLOW_UP_DAYS = 14;

function addDays(ymd: string, days: number): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** RFC 5545 text: escape \ ; , and newlines. */
function icsText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

export function followUpIcs(r: DealResult, today = new Date().toISOString().slice(0, 10)): string {
  const day = r.followUpDate ?? addDays(today, FOLLOW_UP_DAYS);
  const cleared = r.assessments.filter((a) => a.status === "DERISKED").length;
  const description = [
    `${r.deal.companyName} (${r.deal.domain})`,
    `${cleared} of ${r.assessments.length} pass risks de-risked. Conviction ${Math.round(r.conviction.total * 100)}.`,
    r.dealLead ? `Deal lead: ${r.dealLead}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//2ndLook//Follow-up//EN",
    "BEGIN:VEVENT",
    `UID:${r.deal.dealId}-${day}@2ndlook`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${day.replace(/-/g, "")}`,
    `DTEND;VALUE=DATE:${addDays(day, 1).replace(/-/g, "")}`,
    `SUMMARY:${icsText(`Follow up: ${r.deal.companyName}`)}`,
    `DESCRIPTION:${icsText(description)}`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}
