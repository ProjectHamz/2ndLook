import { describe, expect, it } from "vitest";
import {
  assessRisk,
  deriskingScore,
  hasAllocationRisk,
  proofStrength,
  rankByConviction,
  scoreDeal,
  thesisFit,
  tractionScore,
  withStrength,
} from "./scoring";
import type { PassedDeal, ProofPoint, Thesis } from "./types";

const PASS_DATE = "2025-03-10";

const deal: PassedDeal = {
  dealId: "ledgerly",
  companyName: "Ledgerly",
  domain: "ledgerly.example",
  passDate: PASS_DATE,
  partnerName: "Dana Reyes",
  stageAtPass: "Seed",
  sector: "fintech",
  passReasonText: "pre-product, no enterprise customers yet",
  geography: "United States",
  description: "AI agents for accounts payable automation",
};

const thesis: Thesis = {
  fundName: "Harbor Street Ventures",
  sectors: ["fintech", "AI"],
  stages: ["Seed", "Series A"],
  keywords: ["agents"],
  geographies: ["United States"],
  maxRoundSizeUsd: 30_000_000,
};

let n = 0;
function proof(over: Partial<ProofPoint>): ProofPoint {
  return {
    proofId: `p${++n}`,
    source: "akta_news",
    sourceName: "TechCrunch",
    url: "https://example.com/a",
    publishedDate: "2025-06-01",
    quote: "Ledgerly launched its product today.",
    riskCode: "PRE_PRODUCT",
    label: "supports",
    strength: 0,
    primaryCompany: true,
    tagMatchesRisk: true,
    ...over,
  };
}

const scored = (ps: ProofPoint[]) => withStrength(ps, PASS_DATE);

describe("proofStrength", () => {
  it("ignores a proof point dated before the pass", () => {
    expect(proofStrength(proof({ publishedDate: "2025-03-09" }), PASS_DATE)).toBe(0);
  });
  it("counts a proof point on the pass date", () => {
    expect(proofStrength(proof({ publishedDate: PASS_DATE }), PASS_DATE)).toBe(1);
  });
  it("is strong only for primary-company Akta news with a matching tag", () => {
    expect(proofStrength(proof({}), PASS_DATE)).toBe(1);
    expect(proofStrength(proof({ primaryCompany: false }), PASS_DATE)).toBe(0.6);
    expect(proofStrength(proof({ tagMatchesRisk: false }), PASS_DATE)).toBe(0.6);
    expect(proofStrength(proof({ source: "hacker_news" }), PASS_DATE)).toBe(0.6);
    expect(proofStrength(proof({ source: "founder" }), PASS_DATE)).toBe(0.6);
  });
});

describe("assessRisk", () => {
  it("one strong proof point gives De-risked", () => {
    expect(assessRisk("PRE_PRODUCT", scored([proof({})])).status).toBe("DERISKED");
  });

  it("a proof point dated before the pass is ignored", () => {
    const a = assessRisk("PRE_PRODUCT", scored([proof({ publishedDate: "2024-12-01" })]));
    expect(a.status).toBe("NO_COVERAGE");
    expect(a.proofIds).toEqual([]);
  });

  it("a newer contradiction blocks De-risked", () => {
    const a = assessRisk(
      "PRE_PRODUCT",
      scored([proof({ publishedDate: "2025-06-01" }), proof({ label: "contradicts", publishedDate: "2025-08-01" })]),
    );
    expect(a.status).toBe("PARTIAL");
  });

  it("an older contradiction does not block De-risked", () => {
    const a = assessRisk(
      "PRE_PRODUCT",
      scored([proof({ label: "contradicts", publishedDate: "2025-04-01" }), proof({ publishedDate: "2025-06-01" })]),
    );
    expect(a.status).toBe("DERISKED");
  });

  it("zero proof points gives No coverage", () => {
    expect(assessRisk("PRE_PRODUCT", []).status).toBe("NO_COVERAGE");
  });

  it("market-size risks are always a Partner call", () => {
    expect(assessRisk("MARKET_SIZE", []).status).toBe("PARTNER_CALL");
    expect(assessRisk("MARKET_SIZE", scored([proof({ riskCode: "MARKET_SIZE" })])).status).toBe("PARTNER_CALL");
  });

  it("a weak supporting proof point gives Partially de-risked", () => {
    expect(assessRisk("PRE_PRODUCT", scored([proof({ source: "hacker_news" })])).status).toBe("PARTIAL");
  });

  it("only irrelevant or contradicting proof points leave it Open", () => {
    expect(assessRisk("PRE_PRODUCT", scored([proof({ label: "irrelevant" })])).status).toBe("OPEN");
    expect(assessRisk("PRE_PRODUCT", scored([proof({ label: "contradicts" })])).status).toBe("OPEN");
  });

  it("only looks at proof points for its own risk, newest first", () => {
    const a = assessRisk(
      "PRE_PRODUCT",
      scored([
        proof({ proofId: "old", publishedDate: "2025-05-01" }),
        proof({ proofId: "new", publishedDate: "2025-07-01" }),
        proof({ proofId: "other", riskCode: "TEAM_GAP" }),
      ]),
    );
    expect(a.proofIds).toEqual(["new", "old"]);
  });
});

describe("scores", () => {
  it("averages de-risking over all pass risks", () => {
    expect(
      deriskingScore([
        { riskCode: "PRE_PRODUCT", status: "DERISKED", proofIds: [] },
        { riskCode: "TEAM_GAP", status: "PARTIAL", proofIds: [] },
        { riskCode: "MARKET_SIZE", status: "PARTNER_CALL", proofIds: [] },
        { riskCode: "GTM_UNPROVEN", status: "OPEN", proofIds: [] },
      ]),
    ).toBe(0.375);
    expect(deriskingScore([])).toBe(0);
  });

  it("thesis fit adds sector, stage, keywords and geography", () => {
    expect(thesisFit(deal, thesis)).toBeCloseTo(1);
    expect(thesisFit({ ...deal, geography: undefined }, thesis)).toBeCloseTo(0.9);
    expect(thesisFit({ ...deal, sector: "retail", description: "" }, thesis)).toBeCloseTo(0.4);
  });

  it("traction caps at 1", () => {
    expect(tractionScore(scored([proof({})]))).toBeCloseTo(1 / 3);
    expect(tractionScore(scored([proof({}), proof({}), proof({}), proof({})]))).toBe(1);
  });

  it("flags allocation risk only for big rounds after the pass", () => {
    expect(hasAllocationRisk([{ date: "2025-09-01", amountUsd: 50e6 }], PASS_DATE, 30e6)).toBe(true);
    expect(hasAllocationRisk([{ date: "2024-09-01", amountUsd: 50e6 }], PASS_DATE, 30e6)).toBe(false);
    expect(hasAllocationRisk([{ date: "2025-09-01", amountUsd: 10e6 }], PASS_DATE, 30e6)).toBe(false);
  });
});

describe("scoreDeal", () => {
  it("scores the hero deal end to end", () => {
    const out = scoreDeal(
      {
        deal,
        passRisks: [
          { riskCode: "PRE_PRODUCT", sourcePhrase: "pre-product", founderMilestone: "Launch a product" },
          { riskCode: "NO_ENTERPRISE_CUSTOMERS", sourcePhrase: "no enterprise customers yet", founderMilestone: "Sign an enterprise customer" },
        ],
        proofPoints: [
          proof({}),
          proof({ riskCode: "NO_ENTERPRISE_CUSTOMERS", publishedDate: "2025-08-01" }),
          proof({ publishedDate: "2024-01-01" }),
        ],
      },
      thesis,
    );
    expect(out.assessments.map((a) => a.status)).toEqual(["DERISKED", "DERISKED"]);
    expect(out.proofPoints.map((p) => p.strength)).toEqual([1, 1, 0]);
    expect(out.conviction).toEqual({ derisking: 1, thesisFit: 1, traction: 0.67, total: 0.93 });
    expect(out.allocationRisk).toBe(false);
  });

  it("ranks by conviction, then name", () => {
    const r = (name: string, total: number) => ({
      deal: { ...deal, companyName: name },
      conviction: { derisking: 0, thesisFit: 0, traction: 0, total },
    });
    expect(rankByConviction([r("B", 0.5), r("C", 0.9), r("A", 0.5)]).map((x) => x.deal.companyName)).toEqual([
      "C",
      "A",
      "B",
    ]);
  });
});
