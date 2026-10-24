# UI integration (Member A)

The UI is in. Every page reads from **one file**, `lib/secondlook/data.ts`, which today serves
fictional sample data (`lib/secondlook/sample-data.ts`, labeled "Sample data" on screen).
To show real results, make `data.ts` read `getDeals("anti_portfolio")` / `getDeal(id)` from
`lib/deals.ts` and map each `DealResult` to the UI's `CompanyResult`. The pages don't change.

## Pages

| Route | File | Reads |
|---|---|---|
| `/` Overview | `app/page.tsx` | `getRanked`, `countByOverall`, `recentEvidence`, `integrationStatus` |
| `/anti-portfolio` | `app/anti-portfolio/page.tsx` | `getRanked(fundId)` |
| `/brief/[id]` Re-underwrite memo | `app/brief/[id]/page.tsx` | `getCompanyResult(id)`, `draftEmail` |
| `/network` | `app/network/page.tsx` | `NETWORK_SAMPLE` (sample until Roundtable data exists) |
| `/audit` | `app/audit/page.tsx` | `PRISM_SAMPLE` (swap for real PRISM run counts) |
| `/import` | `app/import/page.tsx` | Connect Affinity (`/api/import/affinity`) or CSV |

## Field mapping: `DealResult` (lib/types.ts) to UI (`lib/secondlook/types.ts`)

| UI | DealResult |
|---|---|
| `company.id` | `dealId` |
| `company.name, domain, pass_date, partner, stage_at_pass, sector, pass_reason_text` | `deal.company_name, domain, pass_date, partner, stage_at_pass, sector, pass_reason_text` |
| `company.objections[]` | `passRisks[].riskCode` |
| `evidence[]` | `proofPoints[]`: `publishedDate` to `published_date`, `riskCode` to `objection_code`, `label` to `llm_label`, `primaryCompany` to `primary_company_match`, `tagMatchesRisk` to `tag_maps_to_objection`, `sourceName` for the source label |
| `objections[].verdict` | `assessments[].status`: `DERISKED` to `RESOLVED`, `PARTIAL` to `PARTIAL`, `OPEN` to `NOT_YET`, `NO_COVERAGE` to `INSUFFICIENT_DATA`, `PARTNER_CALL` to `JUDGMENT_CALL` |
| `score` (0 to 100) | `Math.round(conviction.total * 100)` |
| `resolution`, `thesisFit`, `momentum` | `conviction.derisking`, `conviction.thesisFit`, `conviction.traction` |
| `stageDrift` | `allocationRisk` |
| `company.founder_name`, `open_questions` | Not in `DealResult` yet; optional (the note falls back to "there") |

Use the backend's statuses and conviction as-is; don't re-score in the UI.

## Notes

- Re-engagement note: `lib/secondlook/email.ts` is a template that follows the plan's copy rules. Swap in `/api/note/[id]` (Prompt 4) when ready.
- Approve currently saves the deal lead and date in the browser only. Wire it to `/api/affinity/sync/[id]` for the write-back.
- Fonts: Droid Serif (self-hosted in `public/fonts`) for headlines, names and pass-reason quotes; Libre Franklin for everything else.
- Hero loop: `public/media/hero-cards.mp4` was rendered in Blender (scene script kept outside the repo). The starfield is `components/motion/Starfield.tsx`.
- No model calls in the UI code, so nothing new to wire to PRISM.
