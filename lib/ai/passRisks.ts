/**
 * C's Prompt 1: a partner's messy pass note -> pass risks (the 7 codes) + liked traits.
 * The model only reads and tags; `sourcePhrase` must be words copied from the note,
 * so the UI can strike exactly that text through once the risk is de-risked.
 */
import { z } from "zod";
import { chatJson, MODELS } from "../nicrron";
import { normalizeForQuote } from "../quoteCheck";
import type { PassRisk, RiskCode } from "../types";

export const RISK_PARSER_AGENT = "risk-parser-v1";

export const RISK_CODES = [
  "PRE_PRODUCT",
  "NO_ENTERPRISE_CUSTOMERS",
  "TOO_EARLY_REVENUE",
  "TEAM_GAP",
  "GTM_UNPROVEN",
  "MARKET_SIZE",
  "ROUND_DYNAMICS",
] as const satisfies readonly RiskCode[];

/** What each risk means and what clears it. Shared by Prompts 1, 2 and 3. */
export const RISK_GUIDE: Record<RiskCode, { means: string; clearedWhen: string; milestone: string }> = {
  PRE_PRODUCT: {
    means: "no product yet: deck, beta, waitlist, demo, pre-1.0, roadmap only",
    clearedWhen: "the product launched publicly, reached general availability, or has production users",
    milestone: "Product launched publicly",
  },
  NO_ENTERPRISE_CUSTOMERS: {
    means: "no enterprise or marquee customers, only SMB, pilots, hobbyists or indie users",
    clearedWhen: "a named enterprise customer, enterprise contract or enterprise partnership is announced",
    milestone: "A named enterprise customer signs",
  },
  TOO_EARLY_REVENUE: {
    means: "little or no revenue, unclear who pays, revenue durability unproven, burning cash",
    clearedWhen: "revenue figures, ARR milestones, paid plans with paying customers, or revenue growth are reported",
    milestone: "Clear, growing revenue",
  },
  TEAM_GAP: {
    means: "a missing key role or experience, e.g. no senior engineering, sales or go-to-market leader",
    clearedWhen: "the missing kind of leader is hired or appointed",
    milestone: "Key leadership hire made",
  },
  GTM_UNPROVEN: {
    means: "no repeatable distribution, channel, or sales motion",
    clearedWhen: "a working channel is shown: distribution partnerships, a sales team, or repeatable customer growth",
    milestone: "A repeatable sales channel",
  },
  MARKET_SIZE: {
    means: "the market seems too small or too crowded to be venture scale",
    clearedWhen: "only a partner can judge this",
    milestone: "Evidence the market is larger than it looked",
  },
  ROUND_DYNAMICS: {
    means: "valuation too high, round full or oversubscribed, no allocation for us",
    clearedWhen: "a new round opens or the company is raising again",
    milestone: "A new round we could join",
  },
};

const SYSTEM = `You read a venture partner's note explaining why their fund passed on a company.
Tag the note with 1 to 3 pass risks, using ONLY these codes:
${RISK_CODES.map((c) => `- ${c}: ${RISK_GUIDE[c].means}`).join("\n")}

Rules:
- sourcePhrase: the exact words from the note that state the risk, copied character for character (a few words, not the whole note).
- founderMilestone: a short, plain milestone that would answer the risk, written for the founder, e.g. "${RISK_GUIDE.PRE_PRODUCT.milestone}".
- likedTraits: positive remarks copied from the note (e.g. "smart founders"). Empty array if none.
- Do not invent risks the note does not state.

Reply with JSON only:
{"passRisks":[{"riskCode":"...","sourcePhrase":"...","founderMilestone":"..."}],"likedTraits":["..."]}`;

const Schema = z.object({
  passRisks: z
    .array(z.object({ riskCode: z.enum(RISK_CODES), sourcePhrase: z.string().min(1), founderMilestone: z.string().min(1) }))
    .min(1)
    .max(3),
  likedTraits: z.array(z.string()).default([]),
});

export type ParsedPassRisks = { passRisks: PassRisk[]; likedTraits: string[] };

/** Returns null when the model can't produce a valid answer twice (shown as "needs review"). */
export async function parsePassRisks(passReasonText: string, sessionId: string): Promise<ParsedPassRisks | null> {
  const res = await chatJson({
    model: MODELS.fast,
    agentId: RISK_PARSER_AGENT,
    sessionId,
    maxTokens: 600,
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: `Pass note: ${JSON.stringify(passReasonText)}` },
    ],
    parse: (raw) => Schema.parse(raw),
  });
  if (!res.ok) return null;

  // Keep only phrases that really appear in the note, one risk per code.
  const note = normalizeForQuote(passReasonText).toLowerCase();
  const seen = new Set<RiskCode>();
  const passRisks = res.value.passRisks.filter((r) => {
    if (seen.has(r.riskCode)) return false;
    seen.add(r.riskCode);
    return note.includes(normalizeForQuote(r.sourcePhrase).toLowerCase());
  });
  if (passRisks.length === 0) return null;
  return { passRisks, likedTraits: res.value.likedTraits };
}
