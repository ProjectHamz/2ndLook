/**
 * C's Prompt 3: a passed deal's traits + the risk to clear -> one sentence for Akta's
 * Filter Builder, e.g. "Seed-stage US payments infrastructure companies that have launched a product."
 * Plugs into lib/comps.ts as its DescribeFn.
 */
import { z } from "zod";
import { chatJson, MODELS } from "../nicrron";
import type { CompSeed } from "../comps";
import { RISK_GUIDE } from "./passRisks";

export const COMP_AGENT = "comp-describer-v1";

const Schema = z.object({ description: z.string().min(10).max(300) });

const SYSTEM = `You write one-sentence company search descriptions for a startup database.
Describe companies similar to the given company (same sector, stage and business model) that have ALREADY cleared the given milestone.
Do not name the company itself. Use plain words a search filter understands: stage, geography (US), sector, business model, the milestone.
Reply with JSON only: {"description":"..."}`;

export async function describeComp(seed: CompSeed): Promise<string> {
  const user = `Company: ${seed.companyName} (${seed.domain})
Sector: ${seed.sector}
Stage when we met: ${seed.stageAtPass}
What we liked: ${seed.likedTraits.join("; ") || "n/a"}
Milestone already cleared: ${RISK_GUIDE[seed.targetRisk].clearedWhen}`;
  const res = await chatJson({
    model: MODELS.fast,
    agentId: COMP_AGENT,
    sessionId: `comp-seed-${seed.dealId}`,
    maxTokens: 200,
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: user },
    ],
    parse: (raw) => Schema.parse(raw),
  });
  if (!res.ok) throw new Error(`comp description needs review: ${res.error}`);
  return res.value.description;
}
