/**
 * SYNTHETIC demo Affinity workspace.
 *
 * Event rule: public or synthetic data only. Everything here is fictional and
 * matches the sample pipeline output in lib/secondlook/sample-data.ts, so the
 * preview is consistent end to end.
 *
 * PRODUCT LANE: for the live demo, replace DEMO_PASS_LOG_CSV with the final
 * pass log of REAL companies (fictional pass notes) that have Akta coverage,
 * with pass dates BEFORE the events you want to show. Same columns.
 */
export const DEMO_FUND_NAME = "Fund A (sample)";
export const DEMO_FUND_ID = "fund-a";

export const DEMO_PASS_LOG_CSV = `company_name,domain,pass_date,partner,stage_at_pass,sector,pass_reason_text,fund_id
Tidewell Robotics,tidewell.example,2025-03-11,Priya Shah,Seed,Warehouse robotics,"pre-product, just a deck and a sim video. no enterprise pilots yet",fund-a
Ledgerline,ledgerline.example,2025-01-20,Jordan Lee,Seed,"Fintech, AP automation","too early on revenue, under $500k ARR. revisit at the A",fund-a
Quarry Health,quarryhealth.example,2025-06-02,Sam Ortiz,Seed,"Health, clinical scheduling","no technical cofounder, CEO is ex-consulting. great GTM instincts",fund-a
Northpine Analytics,northpine.example,2025-04-15,Priya Shah,Series A,Data infrastructure,"no distribution, all founder-led sales. no enterprise logos",fund-a
Brightfold,brightfold.example,2025-02-27,Jordan Lee,Seed,Edtech,"pre-product. nice waitlist but nothing shipped",fund-a
Cobalt Freight,cobaltfreight.example,2025-05-19,Sam Ortiz,Seed,Logistics software,"valuation too high for us, round basically full",fund-a
Fernway Bio,fernway.example,2025-08-08,Priya Shah,Pre-seed,Lab tooling,"market too small, niche lab tooling",fund-a
Sable Systems,sable.example,2025-09-30,Jordan Lee,Seed,Security software,no enterprise customers yet,fund-a
`;

/** Non-passed entries so the import visibly filters to "Passed" only. Fictional. */
export const DEMO_OTHER_ENTRIES = [
  { name: "Juniper Labs", domain: "juniper.example", status: "In diligence" },
  { name: "Orchard Pay", domain: "orchardpay.example", status: "Portfolio" },
  { name: "Wren Health", domain: "wren.example", status: "First meeting" },
];
