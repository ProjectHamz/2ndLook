/**
 * Draft re-engagement note. Deterministic template for now; lane C can swap in a
 * Nicrron-written draft that follows the same rules (from the build plan):
 *   - 90 words or fewer, opens with the founder's milestone and its date
 *   - offers one concrete thing (an intro or a 20-minute call)
 *   - never restates why the fund passed, never apologizes, never says "we were wrong"
 */
import type { CompanyResult } from "./engine";

function shortDate(iso: string) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" });
}

export function draftEmail(r: CompanyResult): { subject: string; body: string } {
  const c = r.company;
  const first = c.founder_name.split(" ")[0] ?? c.founder_name;
  const proof = r.objections
    .flatMap((o) => o.evidence)
    .filter((e) => e.llm_label === "supports")
    .sort((a, b) => b.published_date.localeCompare(a.published_date))[0];
  const lead = c.partner.split(" ")[0] ?? c.partner;

  if (!proof) {
    return {
      subject: `Checking in on ${c.name}`,
      body: `Hi ${first},

Hope the last few months at ${c.name} have gone well. I'd love to hear what you've been building since we last spoke.

Would a 20-minute call in the next couple of weeks work?

Best,
${lead}`,
    };
  }

  const milestone = proof.title.replace(/\.$/, "");
  return {
    subject: `Congrats on the news, ${first}`,
    body: `Hi ${first},

Congrats: I saw "${milestone}" on ${shortDate(proof.published_date)}. That's a real milestone.

I'd love to hear what's next, and I'm happy to introduce you to two operators in ${c.sector.toLowerCase()} who have scaled through this stage.

Would 20 minutes in the next two weeks work?

Best,
${lead}`,
  };
}
