/**
 * Writes data/mock-deals.json: FAKE results for Member A to build screens on until 1:00 PM.
 * Companies, quotes and links are invented (example.com). Statuses and scores come from
 * lib/scoring.ts, so they always agree with the real rules.
 *
 *   npx tsx scripts/build-mock-deals.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { scoreDeal } from "../lib/scoring";
import type { DealResult, FundingRound, PassedDeal, PassRisk, ProofPoint, Thesis } from "../lib/types";

const root = path.join(__dirname, "..");
const thesis = JSON.parse(readFileSync(path.join(root, "data/thesis.json"), "utf8")) as Thesis;

type Seed = {
  view?: DealResult["view"];
  compOfDealId?: string;
  deal: PassedDeal;
  passRisks: PassRisk[];
  likedTraits: string[];
  proofPoints: Omit<ProofPoint, "strength">[];
  fundingRounds?: FundingRound[];
  trackerToken: string;
};

const akta = (over: Partial<ProofPoint> & Pick<ProofPoint, "proofId" | "riskCode" | "publishedDate" | "quote">) => ({
  source: "akta_news" as const,
  sourceName: "TechCrunch",
  url: `https://example.com/news/${over.proofId}`,
  label: "supports" as const,
  primaryCompany: true,
  tagMatchesRisk: true,
  ...over,
});

const seeds: Seed[] = [
  {
    deal: {
      dealId: "ledgerly",
      affinityEntryId: 1001,
      companyName: "Ledgerly",
      domain: "ledgerly.example",
      passDate: "2025-10-14",
      partnerName: "Dana Reyes",
      stageAtPass: "Seed",
      sector: "fintech",
      passReasonText: "pre-product, smart founders, come back w/ enterprise customers",
      geography: "United States",
      description: "AI agents that close the books for mid-market finance teams",
    },
    passRisks: [
      { riskCode: "PRE_PRODUCT", sourcePhrase: "pre-product", founderMilestone: "Launch a product customers can use" },
      {
        riskCode: "NO_ENTERPRISE_CUSTOMERS",
        sourcePhrase: "come back w/ enterprise customers",
        founderMilestone: "Sign a paying enterprise customer or pilot",
      },
    ],
    likedTraits: ["smart founders"],
    proofPoints: [
      akta({
        proofId: "ledgerly-launch",
        riskCode: "PRE_PRODUCT",
        publishedDate: "2026-02-03",
        quote: "Ledgerly today made its close automation product generally available to finance teams.",
      }),
      akta({
        proofId: "ledgerly-pilot",
        riskCode: "NO_ENTERPRISE_CUSTOMERS",
        publishedDate: "2026-05-19",
        sourceName: "Business Wire",
        quote: "A Fortune 500 manufacturer has begun an enterprise pilot of Ledgerly across its EMEA finance team.",
      }),
      {
        proofId: "ledgerly-hn",
        source: "hacker_news",
        sourceName: "Hacker News",
        url: "https://example.com/hn/ledgerly",
        publishedDate: "2026-02-04",
        quote: "Show HN: Ledgerly, month-end close in a day",
        riskCode: "PRE_PRODUCT",
        label: "supports",
      },
    ],
    fundingRounds: [{ date: "2026-06-10", amountUsd: 12_000_000, roundType: "Series A" }],
    trackerToken: "Lx7kQ2mNp9aZ",
  },
  {
    deal: {
      dealId: "quillstack",
      affinityEntryId: 1002,
      companyName: "Quillstack",
      domain: "quillstack.example",
      passDate: "2025-08-20",
      partnerName: "Marcus Bell",
      stageAtPass: "Seed",
      sector: "developer tools",
      passReasonText: "no technical cofounder?? GTM unclear, PLG or sales",
      geography: "Canada",
      description: "Documentation workflow automation for API teams",
    },
    passRisks: [
      { riskCode: "TEAM_GAP", sourcePhrase: "no technical cofounder??", founderMilestone: "Add a technical cofounder or CTO" },
      { riskCode: "GTM_UNPROVEN", sourcePhrase: "GTM unclear, PLG or sales", founderMilestone: "Show a repeatable sales channel" },
    ],
    likedTraits: [],
    proofPoints: [
      {
        proofId: "quillstack-cto",
        source: "github",
        sourceName: "GitHub",
        url: "https://example.com/gh/quillstack",
        publishedDate: "2026-01-12",
        quote: "Maintainers: @priya-k (CTO)",
        riskCode: "TEAM_GAP",
        label: "supports",
      },
      akta({
        proofId: "quillstack-blog",
        riskCode: "GTM_UNPROVEN",
        publishedDate: "2026-03-30",
        sourceName: "Quillstack blog",
        quote: "We are still experimenting with how teams discover Quillstack.",
        label: "irrelevant",
        tagMatchesRisk: false,
      }),
    ],
    trackerToken: "Qs3vR8tWc1bY",
  },
  {
    deal: {
      dealId: "tallyroute",
      affinityEntryId: 1003,
      companyName: "Tallyroute",
      domain: "tallyroute.example",
      passDate: "2025-05-02",
      partnerName: "Dana Reyes",
      stageAtPass: "Series A",
      sector: "logistics",
      passReasonText: "too early on rev (<$1M ARR), market might be small",
      geography: "United States",
      description: "AI routing for regional freight carriers",
    },
    passRisks: [
      { riskCode: "TOO_EARLY_REVENUE", sourcePhrase: "too early on rev (<$1M ARR)", founderMilestone: "Reach $1M in annual revenue" },
      { riskCode: "MARKET_SIZE", sourcePhrase: "market might be small", founderMilestone: "Show expansion beyond regional carriers" },
    ],
    likedTraits: [],
    proofPoints: [
      akta({
        proofId: "tallyroute-arr",
        riskCode: "TOO_EARLY_REVENUE",
        publishedDate: "2026-03-04",
        sourceName: "Forbes",
        quote: "Tallyroute crossed $5 million in annual recurring revenue last quarter.",
      }),
    ],
    fundingRounds: [{ date: "2026-03-04", amountUsd: 45_000_000, roundType: "Series B" }],
    trackerToken: "Tr5pX2nKe8hJ",
  },
  {
    deal: {
      dealId: "brightcask",
      affinityEntryId: 1004,
      companyName: "Brightcask",
      domain: "brightcask.example",
      passDate: "2026-03-11",
      partnerName: "Ines Okafor",
      stageAtPass: "Pre-seed",
      sector: "consumer",
      passReasonText: "round too hot, valuation stretched",
      description: "Subscription wine club for small producers",
    },
    passRisks: [
      { riskCode: "ROUND_DYNAMICS", sourcePhrase: "round too hot, valuation stretched", founderMilestone: "Raise at a valuation in line with traction" },
    ],
    likedTraits: [],
    proofPoints: [],
    trackerToken: "Bc9mT4qLs6wD",
  },
  {
    view: "comp",
    compOfDealId: "ledgerly",
    deal: {
      dealId: "paylane",
      companyName: "Paylane",
      domain: "paylane.example",
      passDate: "2025-10-14",
      partnerName: "",
      stageAtPass: "Seed",
      sector: "fintech",
      passReasonText: "",
      geography: "United Kingdom",
      description: "AI agents for accounts payable at mid-market companies",
    },
    passRisks: [
      { riskCode: "PRE_PRODUCT", sourcePhrase: "pre-product", founderMilestone: "Launch a product customers can use" },
    ],
    likedTraits: ["AI agents for finance teams", "mid-market focus"],
    proofPoints: [
      akta({
        proofId: "paylane-launch",
        riskCode: "PRE_PRODUCT",
        publishedDate: "2026-04-22",
        sourceName: "Sifted",
        quote: "Paylane launched its accounts payable agent to customers across the UK.",
      }),
    ],
    trackerToken: "Pl2wN7rVb4kF",
  },
];

const results: DealResult[] = seeds.map((s) => {
  const scored = scoreDeal(
    { deal: s.deal, passRisks: s.passRisks, proofPoints: s.proofPoints.map((p) => ({ ...p, strength: 0 })), rounds: s.fundingRounds },
    thesis,
  );
  return {
    view: s.view ?? "anti_portfolio",
    deal: s.deal,
    ...(s.compOfDealId ? { compOfDealId: s.compOfDealId } : {}),
    passRisks: s.passRisks,
    likedTraits: s.likedTraits,
    ...scored,
    ...(s.fundingRounds ? { fundingRounds: s.fundingRounds } : {}),
    trackerToken: s.trackerToken,
    prismChecked: false,
    affinitySynced: false,
  };
});

writeFileSync(path.join(root, "data/mock-deals.json"), JSON.stringify(results, null, 2) + "\n");
console.log(`Wrote ${results.length} mock deals to data/mock-deals.json`);
