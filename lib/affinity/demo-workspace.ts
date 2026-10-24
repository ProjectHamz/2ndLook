/**
 * SYNTHETIC demo Affinity workspace.
 *
 * Event rule: public or synthetic data only. These pass notes, partners and the
 * fund are fictional. The companies are real so Akta returns real news.
 *
 * PRODUCT LANE: replace DEMO_PASS_LOG_CSV with the final 30-company pass log
 * (same columns). Pick companies you've checked have Akta coverage, with pass
 * dates BEFORE the events you want to show. Everything else updates automatically.
 */
export const DEMO_FUND_NAME = "Fund A (demo)";
export const DEMO_FUND_ID = "fund_a";

export const DEMO_PASS_LOG_CSV = `company_name,domain,pass_date,partner,stage_at_pass,sector,pass_reason_text,fund_id
Decagon,decagon.ai,2023-09-12,Jordan Lee,Seed,AI customer support,"pre-product, basically a deck + waitlist. love the team tho",fund_a
Clay,clay.com,2023-03-02,Priya Shah,Series A,Sales tools,no clear distribution yet. revisit if they find a channel,fund_a
Hebbia,hebbia.ai,2023-01-20,Jordan Lee,Seed,AI search,too early on revenue (<$1M ARR) and no enterprise logos,fund_a
Glean,glean.com,2022-11-08,Sam Ortiz,Series B,Enterprise search,"valuation too high for us, round basically full",fund_a
Harvey,harvey.ai,2023-02-15,Priya Shah,Seed,Legal AI,"market too small?? legal is slow to buy software",fund_a
`;

/** Non-passed entries so the import visibly filters to "Passed" only. Fictional. */
export const DEMO_OTHER_ENTRIES = [
  { name: "Northwind Analytics", domain: "northwind.example", status: "In diligence" },
  { name: "Bluebird Robotics", domain: "bluebird.example", status: "Portfolio" },
  { name: "Lumen Health", domain: "lumen.example", status: "First meeting" },
];
