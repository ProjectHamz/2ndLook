# 2ndLook Build Plan

Oct 24, 2026 · @belal

## Overview

We ship one product with two views, fed by the same pass ledger pulled from Affinity, by 4:00 PM. The hero deal must work end to end on real data by 1:30 PM.

- **Anti-Portfolio:** deals you passed on whose pass risks are now de-risked, with dated proof points.
- **Comps:** new comparable companies, like the ones you passed on, that already cleared the same risk. This came from Anthony Rose (SeedLegals): founders often pitch too early, and re-engaging can feel awkward, so sometimes the better move is a comp that already cleared the bar.

**Affinity is the main way in.** The fund connects Affinity, picks its pipeline list, and we pull every passed deal and its pass reason. Uploading a document (PDF, Word, Excel, CSV, or email notes) is the backup. When a partner approves a re-engagement, we write the status back to Affinity. The integration code is real; the demo runs on a simulated Affinity workspace, because the rules allow only public or synthetic data.

All four sponsor tools are required for prizes: akta.pro (proof points and comps), NicrronNinoo (every LLM call), PRISM by Block Convey (checks our labeling), and Roundtable (protects the founder milestone tracker).

**Glossary (use these words everywhere: UI, code, pitch)**

| Term | Meaning |
| --- | --- |
| Pass ledger | The list of deals the fund passed on, with date, partner and reason |
| Pass risk | One specific reason the fund passed ("no product yet") |
| De-risked | The pass risk has been cleared, with proof |
| Partially de-risked | Some proof, not enough to call it cleared |
| Open | No proof yet |
| No coverage | Not enough public data to judge |
| Partner call | A risk only a partner can judge, like market size |
| Proof point | One dated, sourced piece of evidence |
| Conviction score | How strongly a deal deserves a second look |
| Thesis fit | How well a deal matches the fund's thesis |
| Traction | Positive signals since the pass |
| Re-underwrite memo | The one-page case for a second look |
| Re-engagement note | The email to a founder you passed on |
| Outbound note | The email to a comp you've never met |
| Milestone tracker | The founder's page listing what would change the fund's answer |
| Deal lead | The partner who owns the follow-up |
| Allocation risk | The company raised a big round, so the window may be closing |

| Member | Owns | Done means |
| --- | --- | --- |
| A: Demo and UI | Every screen, design system, demo script, backup video, social posts | A judge understands a deal's story in 5 seconds without help |
| B: Data and proof points | Demo pass ledger, simulated Affinity workspace, Akta client, comps search, Hacker News and GitHub signals, fixtures | 30 passed deals and 12 comps cached with dated proof points |
| C: AI pipeline | Nicrron client, document extraction, pass-risk parsing, proof-point labels with quote check, comps queries, notes, PRISM | No claim on screen without a verified quote and link |
| D: Core logic and ship | Types, conviction scoring, API routes, Affinity client, milestone tracker with Roundtable, database, deploy, Devpost, founder brief | Live URL and submission in by 3:50 PM |

**Checkpoints (everyone stops and checks)**

| Time | Checkpoint |
| --- | --- |
| 10:15 AM | Build starts. Keys from all four sponsor tables already in hand. |
| 10:40 AM | Shared contract merged: types, mock data, routes stubbed, empty app live on Vercel. |
| 12:30 PM | Lunch. Prefetch running for all 30 deals. |
| 1:30 PM | Hero deal works end to end: Affinity import, proof points, memo, in the real UI. |
| 2:15 PM | Comps, milestone tracker and Affinity write-back work end to end. |
| 2:45 PM | Data frozen into fixtures. Full demo run-through. No new features after this. |
| 3:15 PM | Backup video recorded. |
| 3:50 PM | Devpost submitted. |
| 4:00 PM | Deadline. Demos start 4:15 PM. |

## Shared contract (10:15 to 10:40, everyone)

Agree on these files first so all four people can work in parallel without waiting on each other. D owns `lib/types.ts`; nobody changes it without telling the group.

**Stack:** Next.js (App Router) with React and TypeScript; Tailwind and shadcn/ui; Lucide icons; Droid Serif. Zod checks the shape of every AI and API response. File readers: unpdf (PDF), mammoth (Word), SheetJS (Excel), Papa Parse (CSV). Supabase (Postgres) for the two tables that need writes. `ics` for calendar files, nanoid for tracker links, Vitest for scoring tests. Vercel for deploy.

**Repo layout**

```
app/
  page.tsx                     import: Connect Affinity, or upload a document
  anti-portfolio/page.tsx      Anti-Portfolio (list + memo)
  comps/page.tsx               Comps (list + memo)
  t/[token]/page.tsx           public founder milestone tracker
  api/affinity/lists/route.ts       GET Affinity lists and fields
  api/affinity/import/route.ts      POST import passed deals from a list
  api/affinity/sync/[id]/route.ts   POST write status back to Affinity
  api/import-document/route.ts      POST any document, returns pass ledger rows
  api/deals/route.ts           GET ranked deals for a view
  api/deal/[id]/route.ts       GET one deal's full memo data
  api/refresh/[id]/route.ts    POST live re-check for one deal
  api/note/[id]/route.ts       POST draft re-engagement or outbound note
  api/calendar/[id]/route.ts   GET .ics file
  api/tracker/[token]/route.ts POST founder proof
lib/
  types.ts  affinity.ts  documents.ts  akta.ts  signals.ts  nicrron.ts
  prompts.ts  quoteCheck.ts  scoring.ts  comps.ts  prism.ts  roundtable.ts
data/
  affinity-mock/*.json         simulated Affinity workspace (real API shapes)
  pass-ledger.csv              same 30 deals, for the document-upload path
  thesis.json                  fund thesis
  fixtures/*.json              frozen API and LLM results
  mock-deals.json              fake data for A until 1:00 PM
```

**Core types (`lib/types.ts`)**

```ts
type RiskCode = "PRE_PRODUCT" | "NO_ENTERPRISE_CUSTOMERS" | "TOO_EARLY_REVENUE" | "TEAM_GAP" | "GTM_UNPROVEN" | "MARKET_SIZE" | "ROUND_DYNAMICS";
type RiskStatus = "DERISKED" | "PARTIAL" | "OPEN" | "NO_COVERAGE" | "PARTNER_CALL";

type PassedDeal = { dealId: string; affinityEntryId?: number; companyName: string; domain: string; passDate: string; partnerName: string; stageAtPass: string; sector: string; passReasonText: string };
type PassRisk = { riskCode: RiskCode; sourcePhrase: string; founderMilestone: string };
type ProofPoint = { proofId: string; source: "akta_news" | "akta_company" | "hacker_news" | "github" | "founder"; sourceName: string; url: string; publishedDate: string; quote: string; riskCode: RiskCode; label: "supports" | "contradicts" | "irrelevant"; strength: number };
type RiskAssessment = { riskCode: RiskCode; status: RiskStatus; proofIds: string[] };
type DealResult = { view: "anti_portfolio" | "comp"; deal: PassedDeal; compOfDealId?: string; passRisks: PassRisk[]; likedTraits: string[]; proofPoints: ProofPoint[]; assessments: RiskAssessment[]; conviction: { derisking: number; thesisFit: number; traction: number; total: number }; allocationRisk: boolean; dealLead?: string; followUpDate?: string; trackerToken: string; prismChecked: boolean; affinitySynced: boolean };
```

**Environment keys (`.env.local` and Vercel):** `AFFINITY_MODE` (`mock` or `live`), `AFFINITY_API_KEY`, `AKTA_API_KEY`, `NICRRON_API_KEY`, `PRISM_API_KEY`, `ROUNDTABLE_SITE_KEY`, `ROUNDTABLE_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `GITHUB_TOKEN` (optional).

**Important deploy rule:** Vercel's file system is read-only, so the deployed app reads results from `data/fixtures/` and writes only to Supabase (founder proofs, deal leads, and the simulated Affinity write-back log). Live API calls happen only for prefetch and the one "Check again" button.

## Member A: demo and UI

The look is mature and simple: white pages, brown accents, square corners, one serif typeface, and nothing on screen that doesn't help a partner decide. The one memorable moment is the old pass reason getting struck through when the deal is de-risked.

### Design system

| Token | Value | Used for |
| --- | --- | --- |
| `--paper` | #FFFFFF | Every page background |
| `--ink` | #1F1A16 | Main text |
| `--ink-2` | #5E554D | Secondary text, dates, meta |
| `--rule` | #E3DCD3 | All borders and dividers (1px) |
| `--brown` | #6B4423 | Primary buttons, links, active tab, focus ring |
| `--brown-dark` | #4E3119 | Primary button hover |
| `--brown-tint` | #F6F1EB | Selected and hovered list rows |
| `--derisked` | #2E6B47 | The word De-risked and its marker |
| `--partial` | #9A6416 | Partially de-risked, Allocation risk |
| `--open` | #7D766F | Open, No coverage, Partner call |

- **Font:** Droid Serif from Google Fonts for everything. Google only serves the regular weight (400), with no bold or italic, so build hierarchy with size and color, never bold. Do not use `font-weight: 700` (the browser fakes it and it looks cheap). Quotes get a 2px brown left rule instead of italics.
- **Type scale:** 32px company name, 22px section headings, 17px body, 15px list rows and tables, 13px dates and footnotes. Line height 1.5 for body, 1.25 for headings.
- **Corners and depth:** `border-radius: 0` on everything (set shadcn `--radius: 0`). No shadows, no gradients. Boxes are separated by 1px `--rule` borders.
- **Spacing:** 8, 12, 16, 24, 32, 48 only.
- **Never use:** eyebrow labels above headings, all-caps text, pill badges, emoji, decorative icons, cards inside cards, toasts, dot-joined meta strings. Icons only where they carry meaning: external link, chevron, check (Lucide, 16px, 1.5 stroke, `--ink-2`).
- **Risk status:** always a word plus an 8x8 square in the status color, never color alone: De-risked, Partially de-risked, Open, No coverage, Partner call.
- **Motion:** only two kinds. (1) The strike-through: when a deal is De-risked for the first time, a 1.5px `--ink-2` line draws left to right across the quoted pass reason in 300ms, ease-out. (2) Row hover background fades in over 120ms. With `prefers-reduced-motion`, the line appears instantly.
- **Focus and access:** 2px `--brown` outline, 2px offset, on every interactive element. Click targets at least 44px tall. All text tokens pass 4.5:1 contrast on white.

### App frame

- **Header (56px, 1px rule below):** left, the wordmark "2ndLook" in 22px `--ink`. Right, the fund name "Harbor Street Ventures" in 15px `--ink-2`, then "Affinity: synced 2 min ago" in 13px `--ink-2`, then a secondary button "Import deals". Nothing else.
- **View tabs (48px, under the header):** two text tabs, "Anti-Portfolio 7" and "Comps 12". The count is `--ink-2`. The active tab has a 2px `--brown` underline and `--ink` text; the inactive tab is `--ink-2`. The URL stays in sync (`/anti-portfolio`, `/comps`).
- **Body:** two panes split by a 1px rule. The deal list on the left is fixed at 440px and scrolls on its own. The memo pane on the right fills the rest, with content capped at 760px wide and 32px padding.
- **Footer line (13px `--ink-2`, bottom of the memo pane):** "Proof points from akta.pro, Hacker News and GitHub. Language model via Nicrron. Labels checked by PRISM. Pipeline synced with Affinity." This keeps all sponsors visible without logos.

### Screen 1: import (first run, `/`)

- Centered column, 640px. Heading (32px): "Which passes deserve a second look?" One sentence under it (17px `--ink-2`): "Connect your pipeline and we check what changed since every pass."
- **Primary path, Connect Affinity:** a brown button "Connect Affinity". It opens an inline step (not a popup) with three fields, one after another:
  1. "Affinity API key": prefilled with "Demo workspace" and a 13px note "Demo: simulated Affinity workspace".
  2. "Pipeline list": a select showing the workspace's lists ("Deal Pipeline", "Seed Pipeline 2026"). Default "Deal Pipeline".
  3. "Pass reason field": a select of that list's fields, defaulting to "Pass Reason". Under it: "Deals with status Passed: 30".
- Then a preview table of the first 5 passed deals: Company, Passed, Partner, Pass reason, Pass risks (parsed, in plain words, for example "No product yet; no enterprise customers"). Primary button: "Import 30 passed deals".
- **Backup path:** a text link under the button, "Or upload a document". It reveals a square drop box (1px `--rule` border, 160px tall): "Drop a PDF, Word, Excel, CSV, or email export." On drag-over, the border turns `--brown`. After upload, the same preview table appears, with a line above it: "We found 30 passed deals in partner-notes.pdf."
- **While checking:** a 2px `--brown` progress bar across the top, and a plain list of companies with a state on the right ("Checking", "3 new proof points", "No new proof points"). Use `aria-live="polite"`. When finished, go to `/anti-portfolio` with the top deal selected.

### Screen 2: Anti-Portfolio deal list (left pane)

- Deals are ordered by conviction score, highest first. Each row is 88px tall, 16px padding, 1px rule below:
  - Line 1: company name (17px `--ink`), and on the right the date of the newest proof point (13px `--ink-2`, for example "Jun 12").
  - Line 2: the original pass reason in quotes (15px `--ink-2`), struck through if every pass risk is De-risked.
  - Line 3: the status marker and word, plus "Founder sent proof" in `--brown` if a founder submitted something through the tracker.
- Selected row: `--brown-tint` background and a 2px `--brown` left border. Up and down arrow keys move the selection; the memo updates immediately.
- Deals that are only Open or No coverage are hidden behind one text link at the bottom: "Show 23 deals with no new proof points". Subtraction is the default.

### Screen 3: re-underwrite memo (right pane)

Top to bottom:

1. **Company name** (32px) with the website as a 15px `--brown` link and an external-link icon.
2. **The story in one sentence** (17px), built from a template, not the model: "You passed on 4 March 2026 because there was no product yet. It launched on 12 June."
3. **Two columns with a 1px rule between them:**
   - Left, "Why you passed": the partner's note verbatim from Affinity, with the 2px brown left rule, then "Priya Shah, 4 Mar 2026" in 13px `--ink-2`. This is where the strike-through plays.
   - Right, "What changed": up to 3 proof points, newest first. Each is the date and source name (13px `--ink-2`), the verbatim quote (15px `--ink`), and a "Read source" link. If there are more, a link: "Show all 7".
4. **Pass risks table:** Pass risk, Status, Proof points. One row per risk, in plain words ("Product launched", not PRE\_PRODUCT).
5. **Thesis fit line** (15px): "Fits Harbor Street's thesis: fintech infrastructure, seed to Series A, New York." A text link "How conviction is scored" expands the breakdown inline: De-risking 1.0 × 0.5, Thesis fit 0.8 × 0.3, Traction 0.6 × 0.2, Conviction 0.86. Also show "Allocation risk: raised a $40M Series B" in `--partial` when flagged.
6. **Action bar**, pinned to the bottom of the memo pane, white with a 1px rule on top: primary "Draft re-engagement note" (brown fill, white text), secondary "Add to calendar" and "Assign deal lead" (white fill, 1px `--brown` border, brown text). Then a small "Check again" text link that runs a live re-check.

**Draft re-engagement note:** opens a 480px panel from the right edge of the memo pane (square, 1px left rule, no shadow, no dark backdrop). Fields: To, Subject, Body (editable, 16px). A note under the body in 13px `--ink-2`: "Leads with their progress. Does not mention why you passed." Buttons: "Approve and sync to Affinity" and "Cancel". After approving, the panel closes and the action bar shows: "Note approved and copied. Affinity status set to Re-engage. Deal lead: Priya Shah, follow up by 31 Oct."

**Add to calendar:** downloads an .ics file for a 30-minute call next Tuesday at 10:00 titled "Catch up with Ledgerly". The button text changes to "Calendar file downloaded" for 3 seconds.

**Assign deal lead:** an inline row appears under the action bar with a deal lead select (defaults to the partner who passed) and a follow-up date (defaults to 7 days out), plus "Save". After saving, the list row shows the deal lead's name.

### Screen 4: Comps list and memo

- **List rows:** company name; "Comp to Ledgerly" (15px `--ink-2`); and the cleared risk in `--derisked` text ("Already launched").
- **Memo, top to bottom:** company name and link; one sentence: "A comp to Ledgerly, which you passed on for having no product. Fernway is in the same space and launched in May." Two columns: left "What you liked in Ledgerly" (sector, stage, business model, and any positive note from the pass ledger), right "Risk already cleared" (proof points in the same format). Thesis fit line. Action bar: "Draft outbound note" (primary) and "Add to Affinity pipeline" (secondary). After adding: "Added to Deal Pipeline in Affinity."

### Screen 5: founder milestone tracker (`/t/[token]`, public)

- White page, centered 560px column, no app header. Fund name in 15px `--ink-2` at the top.
- Heading (28px): "What would change our answer". Sentence: "Thanks for talking with us in March. If any of these happen, send us the link and we'll take another look."
- A list of milestones, one per pass risk, each with a status on the right: "Open" or "Received, under review".
- Form: "Which milestone?" (select), "Link to proof" (URL input, label above the field, never placeholder-only), and a "Send proof" button. Roundtable runs invisibly.
- On success, the form is replaced by: "Received. We'll review it within a week." If Roundtable flags the session: "We couldn't verify this submission. Try again in a minute." If the URL is invalid, the error appears under the field in `--partial`.

### Empty, loading and error states

- No new proof points in Anti-Portfolio: "None of your passed deals have new proof points yet. We check again every Monday." Plus a link to Comps.
- No comps: "No comps found for this thesis yet."
- Loading memo: gray bars in `--rule` color where text will be, no shimmer.
- Live API failure: a one-line notice above the memo: "Akta didn't respond. Showing results saved at 2:45 PM."
- Affinity connection fails: "Couldn't reach Affinity. Check the API key, or upload a document instead."

### Small screens

Below 1024px, the deal list becomes its own page and the memo opens as a separate page with a "Back to deals" link. Test at 375px wide. The demo runs on a laptop at 1440 by 900, browser zoom 110%.

### Copy rules (from Anthony's point about bad blood)

Re-engagement notes lead with the founder's progress and offer something useful. They never restate why the fund passed, never apologize, never say "we were wrong". Every button names its action, and the confirmation uses the same words ("Approve and sync to Affinity" becomes "Affinity status set to Re-engage").

### Member A schedule

| Time | Task |
| --- | --- |
| 10:15 to 10:40 | Shared contract; set up fonts, tokens and Tailwind config |
| 10:40 to 12:30 | App frame, deal list, re-underwrite memo, strike-through, all built on `mock-deals.json` |
| 12:30 to 1:00 | Import screen with the Connect Affinity steps |
| 1:00 to 1:30 | Swap mock data for the real API with D; hero deal end to end |
| 1:30 to 2:15 | Comps list and memo, note panel, calendar, assign deal lead, milestone tracker page |
| 2:15 to 2:45 | Document upload path, empty and error states, small-screen pass, Vercel web design guidelines review |
| 2:45 to 3:15 | Full run-through; rehearse the demo twice |
| 3:15 to 3:35 | Record the backup video (3 minutes, 1440x900) |
| 3:35 to 3:50 | Social posts; help D submit |

**Social posts (for the $150 prize):** 11:30 (team photo and the idea in one line), 2:00 (screenshot of the strike-through), 3:40 (20-second demo clip). Tag SeedLegals, NicrronNinoo, Roundtable, akta.pro, Block Convey, and Somya Gupta on LinkedIn and X. Add the links to Devpost.

## Member B: data and proof points

B builds the demo pass ledger and the simulated Affinity workspace, turns every passed deal into dated proof points, and finds comps. Everything is frozen into fixtures by 2:45 so the demo never depends on a live API.

### Demo data (prepare first)

- **Pass ledger:** 30 **real** companies (so Akta returns real data) passed on by a **fictional** fund, "Harbor Street Ventures", with fictional partner names. Pass dates between 6 and 18 months ago. Write pass reasons the way partners really write them: short and messy ("pre-product, smart founders, come back w/ customers").
- **Simulated Affinity workspace (`data/affinity-mock/`):** the same 30 deals as JSON files shaped exactly like Affinity's real v2 API responses, so D's client works unchanged against a live key later:
  - `lists.json`: two lists, "Deal Pipeline" and "Seed Pipeline 2026".
  - `fields.json`: fields for Deal Pipeline, including "Status" (dropdown with Passed, Active, Re-engage), "Pass Reason" (text), "Deal Lead" (person), and "Pass Date" (date).
  - `list-entries.json`: the 30 passed deals plus about 10 active ones, each an entry with a company entity (name, domain) and its field values.
- **Document version:** the same 30 deals as `pass-ledger.csv` and as a short `partner-notes.pdf` (a few paragraphs of messy notes), for the upload path.
- **Hero deal first:** one company with a clear public launch and a named enterprise customer or partnership in the last year, both dated after its pass date. Check it in the Akta Playground before writing any code.
- **Thesis (`data/thesis.json`):** `{ "sectors": ["fintech infrastructure", "developer tools"], "stages": ["seed", "series a"], "geos": ["US"], "keywords": [...], "maxRoundSizeUsd": 20000000 }`.
- Label every demo screen and file "Synthetic data". Never use a real fund's pass data, including what Femi or Anthony told us.

### Akta client (`lib/akta.ts`)

| Function | Akta API | Notes |
| --- | --- | --- |
| `resolveCompany(domain)` | Company Search | Free. Cache the company UUID. |
| `getNewsSince(domain, passDate)` | News Signals | `primary_company` = domain, `start_date` = pass date, `limit` 25. Fall back to `company` (any mention) if empty. |
| `getCompanySections(domain)` | Company Data | product\_offering, customer\_profile, management\_profile, strategic\_signal only. Never call funding or M&A sections (Enterprise-only, 403). |
| `describeTarget(text)` | Filter Builder | Turns a plain-English description into filters for List Generation. |
| `findCompanies(filters)` | List Generation | Synchronous. Pay-as-you-go returns at most 20 companies per request with no enrichment. |

- Header `x-api-key`. Server-side only.
- Throttle to 20 requests per minute (the pay-as-you-go limit is 25).
- Every response is written to `data/fixtures/akta/<function>-<key>.json` during prefetch.
- On a 403 or 429, return an empty result with a `reason` field, never throw. The UI shows "No coverage" instead of crashing.

### Comps (`lib/comps.ts`, with C)

1. For the 3 to 5 passed deals with the clearest pass risks, C writes a description: "Seed-stage US payments infrastructure companies that have already launched a product."
2. B sends it to Filter Builder, then List Generation (20 results max).
3. Remove companies already in the pass ledger or the Affinity pipeline.
4. For each candidate, run the same proof-point check, but only against the risk we want cleared. Keep candidates where that risk is De-risked or Partially de-risked.
5. Keep the best 12 comps for the demo, each with `compOfDealId` pointing to the passed deal.

### Social and public signals (`lib/signals.ts`)

- **Hacker News:** `https://hn.algolia.com/api/v1/search_by_date?query=<name>&tags=story&numericFilters=created_at_i><passUnix>`. Keep "Show HN" and launch posts whose title contains the company name. Free, no key.
- **GitHub (optional, dev-tool companies only):** releases and new repos in the company's org since the pass date.
- Social proof points cap at strength 0.6 unless they come from the company's own account.

### Prefetch and fixtures

- `scripts/prefetch.ts` runs locally: for each deal, call resolve, news, sections and signals, hand the raw proof points to C's labeling, and save the final `DealResult` to `data/fixtures/deals.json`.
- Run it at 12:30 for all 30. Rerun at 2:30. **Freeze at 2:45** and commit.
- The "Check again" button calls `api/refresh/[id]` live for one deal only, and falls back to the fixture if anything fails.

### Member B schedule

| Time | Task |
| --- | --- |
| Before 10:15 | Get the Akta key; test the hero deal in the Playground |
| 10:15 to 10:40 | Shared contract; write the pass ledger and thesis |
| 10:40 to 11:15 | Simulated Affinity workspace JSON, CSV and PDF versions |
| 11:15 to 12:30 | Akta client, throttle, fixtures writer; verify all 30 companies resolve |
| 12:30 to 1:00 | Run prefetch for all 30 |
| 1:00 to 1:30 | Hero deal end to end with D and A |
| 1:30 to 2:15 | Comps pipeline with C; Hacker News signals |
| 2:15 to 2:45 | Rerun prefetch, spot-check every date and link, freeze fixtures |
| 2:45 to 3:50 | Run-through, bug fixes, final deploy check |

## Member C: AI pipeline

C owns every language-model call, all routed through Nicrron, and makes sure no claim reaches the screen without a verified quote. The model reads and labels; it never decides a risk status.

### Nicrron client (`lib/nicrron.ts`)

- Standard OpenAI SDK with `baseURL: "https://api.nicrron.ai/v1"` and `NICRRON_API_KEY`.
- Pin one strong model by name for labeling and notes, so results stay stable. Use a cheaper pinned model for parsing if it passes the tests. Temperature 0 everywhere.
- Every call returns JSON checked by a Zod schema. If it fails, retry once, then return "needs review".
- Cache every model response in fixtures, keyed by a hash of the prompt.

### Prompt 0: extract a pass ledger from any document

- D's `lib/documents.ts` turns the file into plain text (unpdf, mammoth, SheetJS, Papa Parse). C's prompt reads that text.
- **Output:** an array of `PassedDeal` rows: company name, domain if present, pass date, partner, stage, sector, and the pass reason copied word for word.
- Rows missing a company name or pass reason are dropped and counted: "2 entries skipped: no pass reason found."
- **Test:** `partner-notes.pdf` must return all 30 deals.

### Prompt 1: parse pass risks

- **Input:** `passReasonText` (from Affinity's Pass Reason field or Prompt 0).
- **Output:** an array of `{ riskCode, sourcePhrase, founderMilestone }`, using only the 7 codes. `sourcePhrase` must be words copied from the note. `founderMilestone` is how the tracker phrases it ("Product launched publicly").
- Positive remarks ("smart founders") are saved as `likedTraits` for the Comps "What you liked" column.
- **Test:** run on all 30 reasons; at least 25 must map cleanly. Fix the prompt, not the data.

### Prompt 2: label proof points

- **Input:** one pass risk and one candidate proof point (title, summary, full text, date).
- **Output:** `{ label: "supports" | "contradicts" | "irrelevant", quote, confidence }`.
- **Quote check (`lib/quoteCheck.ts`):** normalize whitespace and quote marks in both the quote and the source text, then require an exact substring match. If it fails, set the label to `irrelevant` and log it. This is the guard against made-up proof.
- Run in batches of 10 to stay fast.

### Prompt 3: comp descriptions

- **Input:** the passed deal's sector, stage, business model, liked traits, and the pass risk to be cleared.
- **Output:** one sentence for Akta's Filter Builder, for example "Seed-stage US payments infrastructure companies that have launched a product and have at least one enterprise customer."
- Hand to B's comps pipeline.

### Prompt 4: notes

- The one-sentence story in the memo is a template, not the model. The model writes only note bodies.
- **Re-engagement note rules:** 90 words or fewer. Open with the specific milestone and its date. Offer one concrete thing (an intro, a 20-minute call). No mention of why the fund passed, no apology, no "we were wrong". Signed by the deal lead.
- **Outbound note (Comps):** 90 words or fewer, references what they've built and why it fits the fund's thesis.
- After generating, run a simple check: if the note contains words from the original pass reason, regenerate once.

### PRISM by Block Convey (`lib/prism.ts`)

- Build a small test set: 20 risk and proof-point pairs labeled by hand (10 supports, 10 irrelevant).
- Run Prompt 2 on them and send the inputs and outputs through PRISM's failure detection. The exact API depends on what the Block Convey table gives us.
- Show the result in the "How conviction is scored" panel: "Labels checked by PRISM: 19 of 20 matched our hand labels." Set `prismChecked: true` on results.
- If PRISM access fails entirely, show our own 20-item accuracy and tell the judges plainly.

### Member C schedule

| Time | Task |
| --- | --- |
| Before 10:15 | Nicrron key and credits; ask the PRISM table how to call it |
| 10:15 to 10:40 | Shared contract |
| 10:40 to 12:30 | Nicrron client, Prompt 1 tested on 30 reasons, Prompt 2 with quote check |
| 12:30 to 1:00 | Label the prefetched proof points in batches |
| 1:00 to 1:30 | Hero deal end to end |
| 1:30 to 2:15 | Prompt 3 with B; Prompt 4 notes |
| 2:15 to 2:45 | PRISM test set and integration; Prompt 0 for document upload |
| 2:45 to 3:50 | Run-through; spot-check every quote on screen against its source |

## Member D: core logic and ship

D owns the Affinity integration, the rules that set every risk status and conviction score, the routes that tie B and C to A's screens, the milestone tracker with Roundtable, and getting the submission in. D is also the integration lead at each checkpoint.

### Affinity client (`lib/affinity.ts`)

Written against Affinity's real v2 API; `AFFINITY_MODE=mock` reads B's JSON files instead of calling the network, with identical return shapes.

| Function | Affinity v2 call | Used for |
| --- | --- | --- |
| `listLists()` | `GET /v2/lists` | The pipeline list select |
| `listFields(listId)` | `GET /v2/lists/{listId}/fields` | The pass reason field select |
| `getPassedDeals(listId, fieldIds)` | `GET /v2/lists/{listId}/list-entries?fieldIds=...` (follow `nextUrl` pages) | Import; keep entries whose Status is Passed |
| `setStatus(listId, entryId, fieldId, value)` | `POST /v2/lists/{listId}/list-entries/{listEntryId}/fields/{fieldId}` | Write back "Re-engage" after approval |

- Auth: `Authorization: Bearer <AFFINITY_API_KEY>`. Field data only comes back if you pass `fieldIds`.
- Map each entry to `PassedDeal` (entity name and domain, Pass Reason, Pass Date, Deal Lead), checked with Zod.
- In mock mode, write-backs are logged to Supabase `affinity_sync_log` so the demo can show them, and the header shows "Affinity: synced".
- Affinity's v2 API appears to only read notes, so we write status to a field rather than adding a note.

### Document import (`lib/documents.ts`)

Detect the file type and extract plain text: unpdf (PDF), mammoth (Word), SheetJS (Excel), Papa Parse (CSV), raw text for .eml and .txt. Hand the text to C's Prompt 0 and return `PassedDeal[]`. Max file size 10 MB.

### Conviction scoring (`lib/scoring.ts`, pure functions, unit-tested)

- **Proof-point strength:** 0 if published before the pass date. 1.0 if it's from Akta with `primary_company` and its news tag matches the risk. 0.6 otherwise (mention-only, social, or founder-submitted).
- **Risk status:** De-risked if at least one "supports" proof point at 1.0 and no newer "contradicts". Partially de-risked if the best "supports" proof point is 0.6. No coverage if zero proof points came back. Partner call for MARKET\_SIZE. Open otherwise.
- **Conviction score:** De-risking (De-risked 1, Partially 0.5, others 0, averaged) × 0.5 + Thesis fit × 0.3 + Traction × 0.2. Thesis fit = sector 0.4 + stage 0.3 + keywords 0.2 + geography 0.1.
- **Allocation risk:** a round larger than `maxRoundSizeUsd` after the pass date.
- **Tests (Vitest):** a proof point dated before the pass is ignored; one strong proof point gives De-risked; a newer contradiction blocks De-risked; zero proof points gives No coverage; market-size risks are always a Partner call.

### API routes

| Route | Does |
| --- | --- |
| `GET /api/affinity/lists` | Lists and their fields for the import screen |
| `POST /api/affinity/import` | Pulls passed deals from the chosen list, parses pass risks |
| `POST /api/affinity/sync/[id]` | Writes "Re-engage" (or adds a comp to the pipeline) in Affinity |
| `POST /api/import-document` | Any document to `PassedDeal[]` |
| `GET /api/deals?view=anti_portfolio` | Ranked `DealResult[]` from fixtures, merged with Supabase deal leads and founder proofs |
| `GET /api/deal/[id]` | One deal's full memo data |
| `POST /api/refresh/[id]` | Live re-check for one deal; falls back to the fixture |
| `POST /api/note/[id]` | Calls C's Prompt 4; returns subject and body |
| `GET /api/calendar/[id]` | Returns an .ics file (no calendar sign-in) |
| `POST /api/tracker/[token]` | Founder proof: verify Roundtable, run the proof-point check, store |

### Milestone tracker and Roundtable

- Each passed deal gets a `trackerToken` (random, 12 characters) at import.
- `/t/[token]` loads only the fund name and that deal's `founderMilestone` list. No other deal data is exposed.
- Load the Roundtable script with `ROUNDTABLE_SITE_KEY` on that page. On submit, the server fetches the session's risk report with `ROUNDTABLE_API_KEY`. High risk: reject with A's message. Low risk: continue.
- Accepted proof URLs run through the same check (fetch the page text, C's Prompt 2, quote check) and are stored as `source: "founder"` at strength 0.6. The deal list row then shows "Founder sent proof".
- **Supabase tables:** `founder_proofs (token, milestone, url, label, quote, created_at)`, `deal_leads (deal_id, deal_lead, follow_up_date)`, `affinity_sync_log (deal_id, field, value, synced_at)`. Nothing else is written at runtime.

### Deploy

- Vercel project connected to the repo at 10:40, deployed on every push to main. All env keys set in Vercel, `AFFINITY_MODE=mock`.
- After the 2:45 freeze, only bug-fix commits. Check the live URL on a phone and a second laptop before submitting.

### Submission (Devpost, by 3:50)

- Name, description, Track 1: Sourcing, Wokelo's Best Use of External Data award.
- **Tools, required:** NicrronNinoo, PRISM by Block Convey, akta.pro by Wokelo AI, Roundtable. Also Affinity API (simulated workspace), Next.js, Supabase, Vercel, Hacker News API.
- Public repo link, live demo link, backup video link, social post links.
- **One-page founder brief:**
  - Problem: "not yet" passes go stale in the CRM; partners regret the ones that made it.
  - Customer: seed and Series A partners and associates already on Affinity; the managing partner buys.
  - Interview evidence: Femi Palmer (Initio Capital) passed on a company over an unclear product and never revisited it after they took off. Anthony Rose (SeedLegals) said founders often pitch too early and re-engaging can feel awkward. Use names only with their permission.
  - Market: about 2,984 US VC firms (NVCA 2026 Yearbook); price hypothesis $400 to $800 per fund per month, not validated.
  - Competition: Affinity itself, Harmonic, Specter, Dealtable, and the gap: risk-level status with proof, a founder side, and comps. We sit on top of Affinity, not against it.
  - Business model and first 10 customers: VC Lab emerging managers, today's judges' funds, Affinity's own customer base.
  - Why now: cheap, cited proof-point matching from data APIs and language models.

### Member D schedule

| Time | Task |
| --- | --- |
| Before 10:15 | Roundtable keys; confirm Roundtable is the bot-detection product; Supabase project |
| 10:15 to 10:40 | Repo, types, mock data, route stubs, Vercel deploy |
| 10:40 to 11:30 | Affinity client and import routes (mock mode) |
| 11:30 to 12:30 | Conviction scoring with tests, deals route |
| 12:30 to 1:00 | Founder brief draft |
| 1:00 to 1:30 | Lead the hero deal integration |
| 1:30 to 2:15 | Milestone tracker, Roundtable, Supabase, Affinity write-back, note and calendar routes |
| 2:15 to 2:45 | Integrate Comps and document import end to end |
| 2:45 to 3:35 | Run-through, bug fixes, Devpost draft |
| 3:35 to 3:50 | Submit |

## Demo script, cut list and open questions

The demo tells one partner's story in 3 minutes: the regret, the proof, the action in Affinity, then the comps. Every beat is something a judge sees on screen.

| Time | Say | Screen |
| --- | --- | --- |
| 0:00 to 0:20 | "A venture studio partner told us he passed on a company because the product was unclear. A year later they had made it, and he never went back." | Import screen |
| 0:20 to 0:45 | "Every fund already logs its passes in Affinity. Connect it, pick the pipeline, and we pull 30 passed deals with the notes partners actually wrote." | Screen 1, Connect Affinity steps |
| 0:45 to 1:30 | Open the hero deal. "They passed in March: no product, no enterprise customers. Since then: launched in June, enterprise pilot in August." The pass reason gets struck through. De-risked. | Screen 3, re-underwrite memo |
| 1:30 to 1:55 | "Draft re-engagement note": it leads with their launch, never the pass. Approve and sync to Affinity. Add to calendar. Deal lead and follow-up date set. | Note panel, action bar |
| 1:55 to 2:15 | Open the milestone tracker: "Founders get a checklist of what would change our answer and send proof themselves. Roundtable keeps bots out." | Screen 5 |
| 2:15 to 2:35 | Switch to Comps. "Sometimes the better move is a new company that already cleared the risk. A comp to Ledgerly, already launched." Add to Affinity pipeline. | Screen 4 |
| 2:35 to 3:00 | "Affinity remembers why you said no. 2ndLook tells you when that reason stops being true, finds who already cleared it, and writes it back to your pipeline." Buyer, price, sponsors. | Memo footer |
|  |  |  |

**Cut list, in order, if the 1:30 checkpoint slips:** document upload (Affinity is the main path), GitHub signals, the "Check again" live button, the Assign deal lead row (keep the text), small-screen layout, the allocation risk flag, the import progress list.

**Never cut:** Connect Affinity and the write-back, the hero deal end to end, verified quotes and links on every proof point, the strike-through, the re-engagement note, the milestone tracker with Roundtable, Comps with at least 3 companies, all four sponsor tools.

**Open questions to settle at kickoff (before 10:15)**

- [ ] Is "Roundtable" the bot-detection company (now Proof of Human)? Get the site key and API key. Owner: D.
- [ ] How do we call PRISM? Get a key or endpoint from Block Convey. Owner: C.
- [ ] Nicrron hackathon credits, or do we pay the $10 minimum? Owner: C.
- [ ] Akta key limits: do News Signals and List Generation work on our key? Owner: B.
- [ ] Does anyone at the event have an Affinity sandbox (no real fund data) we could test the live mode against? Owner: D.
- [ ] Ask Femi Palmer and Anthony Rose if we can name them in the pitch and on Devpost. Ask Femi whether "went public" means launched or listed on a stock exchange. Owner: Belal.
- [ ] Confirm the 4:00 PM deadline with organizers. Owner: D.
