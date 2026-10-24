/**
 * C's Prompt 4: the re-engagement note (a founder we passed on) and the outbound note (a comp
 * we've never met). The model writes only the note; facts come from verified proof points.
 *
 * Copy rules (build plan, Anthony's point about bad blood): lead with the founder's progress,
 * offer one concrete thing, never restate why we passed, never apologize, 90 words or fewer.
 */
import { z } from "zod";
import { chatJson, MODELS } from "../nicrron";
import { normalizeForQuote } from "../quoteCheck";
import type { CompanyResult } from "../secondlook/engine";
import type { DealResult, Thesis } from "../types";

export const NOTE_AGENT = "note-writer-v1";
const MAX_WORDS = 90;

export type Note = { subject: string; body: string };

const Schema = z.object({ subject: z.string().min(1), body: z.string().min(1) });

/** Phrases that bring back the pass. Checked after generation; one regeneration if found. */
const BANNED = [/\bpass(ed|ing)? on\b/i, /\bwe passed\b/i, /\bsorry\b/i, /\bapolog/i, /\bwe were wrong\b/i, /\bmistake\b/i, /\bregret/i];

/** What the prompt needs, whichever data model the deal comes from. */
type NoteInput = {
  dealId: string;
  outbound: boolean;
  companyName: string;
  domain: string;
  passReasonText: string;
  /** Verified "supports" proof points. */
  facts: { date: string; sourceName: string; quote: string }[];
};

type NoteOpts = { dealLead: string; thesis: Pick<Thesis, "fundName" | "sectors" | "stages" | "keywords"> };

/** Any 3-word run from the pass note appearing in the body counts as restating the pass. */
export function restatesPass(body: string, passReasonText: string): boolean {
  const words = normalizeForQuote(passReasonText).toLowerCase().replace(/[^a-z0-9$ ]/g, " ").split(/\s+/).filter(Boolean);
  const text = ` ${normalizeForQuote(body).toLowerCase().replace(/[^a-z0-9$ ]/g, " ").replace(/\s+/g, " ")} `;
  for (let i = 0; i + 3 <= words.length; i++) if (text.includes(` ${words.slice(i, i + 3).join(" ")} `)) return true;
  return BANNED.some((re) => re.test(body));
}

function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

/** For lib/deals.ts results (/api/note/[id]). */
export function draftNote(result: DealResult, opts: NoteOpts): Promise<Note> {
  return draftFrom(
    {
      dealId: result.dealId,
      outbound: result.view === "comp",
      companyName: result.deal.company_name,
      domain: result.deal.domain,
      passReasonText: result.deal.pass_reason_text,
      facts: result.proofPoints
        .filter((p) => p.label === "supports")
        .map((p) => ({ date: p.publishedDate, sourceName: p.sourceName, quote: p.quote })),
    },
    opts,
  );
}

/** For the UI's results (the memo page reads Supabase through lib/secondlook/data.ts). */
export function draftNoteForCompany(r: CompanyResult, opts: NoteOpts): Promise<Note> {
  return draftFrom(
    {
      dealId: r.company.id,
      outbound: false,
      companyName: r.company.name,
      domain: r.company.domain,
      passReasonText: r.company.pass_reason_text,
      facts: r.objections
        .flatMap((o) => o.evidence)
        .filter((e) => e.llm_label === "supports" && e.published_date > r.company.pass_date)
        .map((e) => ({ date: e.published_date, sourceName: e.source === "hacker_news" ? "Hacker News" : "Akta news", quote: e.quote })),
    },
    opts,
  );
}

async function draftFrom(input: NoteInput, opts: NoteOpts): Promise<Note> {
  // Newest three verified facts; the note leads with them.
  const facts = [...input.facts]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3)
    .map((f) => `- ${f.date} (${f.sourceName}): "${f.quote}"`)
    .join("\n");
  const outbound = input.outbound;

  const system = `You write short emails from a venture investor to a founder. Plain, warm, specific, no hype.
Rules:
- ${MAX_WORDS} words or fewer in the body.
- ${outbound ? "Open with what they have built, using the facts below, and say in one sentence why it fits the fund's thesis." : "Open with their specific milestone and its month, using the facts below."}
- Offer exactly one concrete thing: a 20-minute call, or an intro to a relevant customer or operator.
- ${outbound ? "This is a first contact; do not imply you have met." : "Never mention why the fund passed, any earlier decision, or concerns. No apology. Do not say we were wrong."}
- Only use facts listed below. Do not invent numbers, customers or dates.
- Sign off with ${opts.dealLead.trim() ? "the investor's first name only" : `"The ${opts.thesis.fundName} team"`}. Never use placeholders like [Name].
Reply with JSON only: {"subject":"...","body":"..."}`;

  const user = `Investor: ${opts.dealLead.trim() || "the team"}, ${opts.thesis.fundName}
Company: ${input.companyName} (${input.domain})
${outbound ? `Fund thesis: ${opts.thesis.sectors.join(", ")}; stages ${opts.thesis.stages.join(", ")}; keywords ${opts.thesis.keywords.join(", ")}` : ""}
Facts since we last spoke:
${facts || "- (no verified facts; keep it to a short, friendly check-in)"}`;

  let last: Note | null = null;
  let lastError = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await chatJson({
      model: MODELS.reasoning,
      agentId: NOTE_AGENT,
      sessionId: `note-${input.dealId}`,
      maxTokens: 4000,
      noCache: attempt > 0,
      messages: [
        { role: "system", content: system },
        { role: "user", content: attempt === 0 ? user : `${user}\n\nYour last draft broke a rule (too long, or it referred to the earlier decision). Try again.` },
      ],
      parse: (raw) => Schema.parse(raw),
    });
    if (!res.ok) {
      lastError = res.error;
      continue;
    }
    last = res.value;
    const ok = wordCount(last.body) <= MAX_WORDS && (outbound || !restatesPass(last.body, input.passReasonText));
    if (ok) return last;
  }
  if (last) return last;
  throw new Error(`Couldn't draft a note: ${lastError}`);
}
