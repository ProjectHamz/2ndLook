/**
 * C's Prompt 2: does one candidate proof point show that one pass risk has been cleared?
 * The model labels and quotes; it never decides a risk status (lib/scoring.ts does).
 *
 * Two versions, traced to PRISM under their own agent names for the v1 -> v2 comparison:
 *   labeler-v1: model output as-is.
 *   labeler-v2: stricter quoting instructions + lib/quoteCheck.ts + no evidence from before the pass.
 */
import { z } from "zod";
import { chatJson, MODELS } from "../nicrron";
import { enforceQuote } from "../quoteCheck";
import type { ProofLabel, RiskCode } from "../types";
import { RISK_GUIDE } from "./passRisks";

export type LabelerVersion = "v1" | "v2";

/** The evidence fields the labeler reads. Matches B's ProofCandidate (lib/partb-types.ts). */
export type LabelCandidate = { title: string; summary: string; fullText: string; publishedDate: string; sourceName?: string };

export type LabelResult = { label: ProofLabel; quote: string; confidence: number; rejected?: string };

/** Long articles are cut so a batch stays fast; the quote is still checked against the full text. */
const MAX_EVIDENCE_CHARS = 6000;

const Schema = z.object({
  label: z.enum(["supports", "contradicts", "irrelevant"]),
  quote: z.string().default(""),
  confidence: z.number().min(0).max(1).default(0.5),
});

function systemPrompt(version: LabelerVersion): string {
  const base = `You check evidence for a venture fund. The fund passed on a company for one specific reason (the pass risk).
Read one piece of evidence published after the pass and decide whether it shows that risk has been cleared.

Labels:
- supports: the evidence directly shows the risk has been cleared.
- contradicts: the evidence directly shows the risk is still true or got worse.
- irrelevant: anything else, including vague, promotional or unrelated text.`;

  const quoting =
    version === "v1"
      ? `quote: the key evidence for your label.`
      : `quote: copy ONE contiguous passage from the EVIDENCE TEXT, character for character, at least 6 words long.
Do not paraphrase, summarize, shorten, fix typos, join sentences or use "...". If no single passage clearly shows it, label irrelevant and leave quote empty.`;

  return `${base}

${quoting}
confidence: 0 to 1.

Reply with JSON only: {"label":"supports|contradicts|irrelevant","quote":"...","confidence":0.0}`;
}

function evidenceText(c: LabelCandidate): string {
  return [c.title, c.summary, c.fullText].filter(Boolean).join("\n\n");
}

export async function labelProofPoint(
  riskCode: RiskCode,
  candidate: LabelCandidate,
  opts: { version: LabelerVersion; passDate: string; companyName: string; sessionId: string; model?: string },
): Promise<LabelResult> {
  const fullText = evidenceText(candidate);

  if (opts.version === "v2" && candidate.publishedDate < opts.passDate) {
    return { label: "irrelevant", quote: "", confidence: 1, rejected: "before_pass_date" };
  }

  const guide = RISK_GUIDE[riskCode];
  const user = `Company: ${opts.companyName}
Passed on: ${opts.passDate}
Pass risk: ${riskCode}: ${guide.means}
Cleared when: ${guide.clearedWhen}

EVIDENCE (${candidate.sourceName ?? "source"}, published ${candidate.publishedDate}):
EVIDENCE TEXT:
${fullText.slice(0, MAX_EVIDENCE_CHARS)}`;

  const res = await chatJson({
    model: opts.model ?? MODELS.reasoning,
    agentId: `labeler-${opts.version}`,
    sessionId: opts.sessionId,
    maxTokens: 400,
    messages: [
      { role: "system", content: systemPrompt(opts.version) },
      { role: "user", content: user },
    ],
    parse: (raw) => Schema.parse(raw),
  });
  if (!res.ok) return { label: "irrelevant", quote: "", confidence: 0, rejected: "needs_review" };

  if (opts.version === "v1") return res.value;
  const checked = enforceQuote(res.value, fullText, `${opts.companyName} ${riskCode}`);
  return {
    label: checked.label as ProofLabel,
    quote: checked.quote,
    confidence: checked.confidence,
    ...(checked.quoteCheck.ok ? {} : { rejected: `quote_${checked.quoteCheck.why}` }),
  };
}

/** Runs tasks with at most `size` in flight (the build plan's batches of 10). */
export async function inBatches<T, R>(items: T[], size: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]!, i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, worker));
  return out;
}

/**
 * Akta news tags that count as on-topic for each risk. lib/scoring.ts only gives full
 * strength (De-risked) when the tag matches, so this is a fixed rule, not a model call.
 */
const RISK_TAG_WORDS: Record<RiskCode, string[]> = {
  PRE_PRODUCT: ["launch", "product", "release", "availability"],
  NO_ENTERPRISE_CUSTOMERS: ["partnership", "customer", "contract", "client", "deal", "enterprise"],
  TOO_EARLY_REVENUE: ["revenue", "growth", "arr", "financial", "milestone"],
  TEAM_GAP: ["hire", "hiring", "appoint", "executive", "leadership", "management", "personnel"],
  GTM_UNPROVEN: ["partnership", "distribution", "expansion", "channel", "customer", "sales"],
  MARKET_SIZE: [],
  ROUND_DYNAMICS: ["funding", "round", "raise", "investment", "financing"],
};

export function tagMatchesRisk(tags: string[] | undefined, riskCode: RiskCode): boolean {
  const words = RISK_TAG_WORDS[riskCode];
  return !!tags?.some((t) => words.some((w) => t.toLowerCase().includes(w)));
}
