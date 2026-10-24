# SecondLook: what we have to do today

Deal Flow: NYC's First VC Hackathon @ Betaworks, Oct 24, 2026.
Sources: [Devpost overview](https://nyc-vc-hack.devpost.com/), [Rules](https://nyc-vc-hack.devpost.com/rules), [Resources](https://nyc-vc-hack.devpost.com/resources).

One line: **SecondLook tells a fund when the reason it said no has gone away, with dated proof, and learns from every fund which kinds of "no" turn out wrong.**

---

## 0. The big three (read this first)

1. **Devpost submission closes at 4:00 PM.** The Rules page also says 4:30 in one spot. **Plan for 4:00.**
2. **We must use all four sponsor tools** (Nicrron, PRISM, akta.pro, Roundtable), or we can't win any prize.
3. **Only public or synthetic data.** Never upload confidential fund, LP or company data we don't have permission to share.

---

## 1. Required sponsor tools (all four, or no prizes)

| Tool | What it is | How SecondLook uses it | Status |
|---|---|---|---|
| **Nicrron (NicrronNinoo)** | One API for 80+ AI models, OpenAI-compatible. Also offers Ninoo Builder (app agent) and Ninoo Code (terminal agent). [Full guide](https://docs.google.com/document/d/1x2gTHi39wIUNlUZefGzugnYop7oLPNG4/edit?usp=sharing&ouid=115689637888033624392&rtpof=true&sd=true) | **Every AI call** goes through Nicrron: turning messy reasons into standard reasons, labeling evidence, writing briefs and emails. | [x] account, $260 credit, key made |
| **akta.pro by Wokelo** | Company data, news and signals via API or MCP. [docs.akta.pro](https://docs.akta.pro) | Find the company, then pull news since the pass date (launches, partnerships, funding, hires). This is our main evidence source, **and it's also how we compete for Wokelo's prize.** | [ ] credits redeemed |
| **PRISM by Block Convey** | Tracing and evaluation for AI agents: records every AI run, finds problems, and lets you add rules and check them. [Docs](https://blockconvey.com/docs) | Trace every Nicrron call. Add the rule "every 'supports' label must quote text that really appears in the source." Show v1 breaking the rule and v2 passing on the same inputs. | [ ] |
| **Roundtable** | "A data platform that lets your AI agents talk to each other." [Quick start (Notion, needs login)](https://app.notion.com/p/Build-on-Roundtable-hackathon-quick-start-402cdc879e1b80baa982e5c49046787f) | **The network layer.** Each fund's SecondLook agent posts anonymized outcomes ("reason type X came true after Y months") to a shared Roundtable space, and other funds' agents read them. Our own agents (reason parser, evidence labeler, brief writer) also hand off work through Roundtable. **Confirm how it works from the quick start.** | [ ] |

**Optional (not required):** Solari by Pinetree Research gives agents cloud browsers, code sandboxes and desktops. [Docs](https://drive.google.com/file/d/1GwP-s9MsDp4vAv7XzWmNSDjWa6e-DW70/view?usp=sharing). Promo code `VC-HACK1MO-DNNXSYYM`.

### Setup and credits

**Nicrron**
```js
import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "https://api.nicrron.ai/v1",
  apiKey: process.env.NICRRON_API_KEY,
});
```
- Put the key in `.env` as `NICRRON_API_KEY`. **Never commit it** and never paste it in chat. Make sure `.env` is in `.gitignore`.
- Server-side calls only. The key never goes to the browser.
- Playground: paste the key into the playground's settings (the sliders icon, top right).
- If you lost the full key, click **Rotate** on the API keys page and copy the new one right away.

**akta.pro credits**
- Sign up [here](https://playground.akta.pro/login?redirectTo=dashboard%2Fmanage%2Fbilling&plan_code=pro_50_1250&source=dealflowhk).
- Subscribe to the $50/month Pro plan and enter promo code `DEALFLOW50` at checkout. The first month is $0. **Cancel from Billing after the event.**
- Save the key as `AKTA_API_KEY`.

**PRISM** (one workspace per team)
1. Sign up at https://prism.blockconvey.com/signup.
2. Go to Settings, then Billing, and redeem `DEALFLOW` (Builder plan, 200 credits).
3. Invite your teammates.
4. Go to Settings, then API Keys, and save the key as `PRISMTRACE_API_KEY`.
5. Install: `pip install prismtrace-sdk` (Python), **or** add PRISM as an OpenTelemetry exporter. Our app is Next.js, so the OpenTelemetry route fits better.

Tracing and analysis are free: up to 200 runs a day analyzed per workspace. We bring our own model key, which is Nicrron.

**PRISM challenge steps (do these, judges look for them)**
1. Run the evidence labeler 20+ times on **fixed inputs**, with one name per version (for example `labeler-v1`).
2. Get **50+ runs into PRISM before fixing anything.**
3. Connect your editor to PRISM's MCP and use PRISM's tools to find a real problem.
4. Add a rule through MCP. Ours: "every 'supports' label must include a word-for-word quote found in the source."
5. Ship `labeler-v2` and show **v1 breaking the rule while v2 passes on the same inputs.**

PRISM bonus points: a guardrail; a second rule (ours: "evidence date must be after the pass date"); your own evaluator; two stacks; and the best PRISM bug report with a trace ID, which is a tie-breaker.

**Roundtable**
- Open the quick start (Notion link above), set up an account and key, and save the key as `ROUNDTABLE_API_KEY`.
- **Owner:** whoever reads the quick start updates this section with the real setup steps.

---

## 2. Schedule

| Time | What |
|---|---|
| 10:15 / 10:30 | Building starts |
| **4:00 PM** | **Devpost submissions close** |
| 4:15 | Live demos to judges |
| 6:00 | Final demos and awards |

Our deadlines:
- **2:30:** feature freeze. Bug fixes only after this.
- **3:00:** record the demo video (3 minutes or less).
- **3:30:** founder brief, description and links written.
- **3:45:** submitted on Devpost. Don't wait for 4:00.

---

## 3. How we're judged (each scored 1 to 5)

| Criterion | What it means | How we win it |
|---|---|---|
| **Design** | Easy and fast for the user, with value in the first minute | Upload, then a ranked queue with green "Resolved" chips in under 10 seconds. Old reason on the left, proof on the right. |
| **Uniqueness** | Solves it in a way existing tools don't | Affinity and Harmonic remember why you passed. We know how often that reason turns out wrong, across funds. |
| **Product and technical execution** | Works end to end on realistic data | Real companies plus real Akta news, using a synthetic (clearly labeled) pass log. Full flow from CSV to approved email. |
| **Business feasibility** | Could be a company a fund pays for every year | Price per fund per year, the network that grows with every fund, and interview evidence in the founder brief. |

## 4. Prizes

- **Grand Winner:** $500 cash, plus perks.
- **Best Content:** $150 cash. Post about the build on **LinkedIn and X during the hack**, tag the sponsors and organizers, and put the post links in our Devpost submission. **Assign one person.**
- **Wokelo's Best Use of External Data:** the team that gets the most out of the Akta API. We should enter this, since Akta is our main evidence source.

## 5. What to submit on Devpost

- [ ] Project name and description
- [ ] Track (Track 1: Sourcing) and sponsor award entered (Wokelo's Best Use of External Data)
- [ ] **One-page founder brief:** problem, customer, interview evidence, market size, competition, business model, why now
- [ ] Tools used, **including all four required tools**
- [ ] Code repo link (this repo, public)
- [ ] Live demo link (deployed on Vercel)
- [ ] Demo video, 3 minutes or less
- [ ] Social post links (for the Content prize)

---

## 6. What we're building

### Core
1. **Connect Affinity** (main path) or upload a CSV (fallback link). Either way we get the same pass-log rows. See section 6a.
2. AI (through Nicrron) turns each messy reason into 1 to 3 standard reasons: no product yet, no big customers, too early on revenue, team gap, no distribution, market too small, round dynamics.
3. Akta finds the company and pulls news since the pass date. EDGAR Form D checks for new funding.
4. AI (through Nicrron, traced in PRISM) labels each piece of evidence as supports, contradicts or irrelevant, **and must quote it word for word**.
5. Fixed rules (not the AI) decide each verdict: Resolved, Partial, Not yet, Insufficient data, Judgment call.
6. Ranked queue, one-page brief (old reason left, dated proof right), and a draft email that needs a human to approve it.

### Network layer (answers "it's a feature" and "an agent could do it")
7. **Reason tag** next to every reason: "Across the network, this came true for [X] in 10, usually within [Y] months."
8. **Network screen:** one bar chart showing each type of "no" and how often it came true. The data flows between fund agents through **Roundtable**.
9. **"What we share" panel:**
   - Shared: reason type, date, and whether it came true.
   - Never shared: company names, fund names, or notes.
10. **PRISM v1 vs v2** view: the same inputs, with v1 breaking the quote rule and v2 passing.

### Out of scope
Auth, sending real email, CRM write-back, LinkedIn (no scraping), scheduled jobs.

### 6a. Connect Affinity (already built, in this repo)

Say "**connects to Affinity**," never "Affinity plugin." A plugin is a feature of Affinity, and that's the exact criticism we're answering.

**Files** (drop into the Next.js app; imports are relative, so no path alias is needed):

| File | What it does |
|---|---|
| `components/ConnectAffinity.tsx` | The "Connect Affinity" button, then a list picker, then the import, plus an "or upload a CSV" fallback. Calls `onImported(rows, meta)`. |
| `app/api/import/affinity/route.ts` | `GET` returns `{ mode, lists }`. `POST { listId }` returns the imported rows. |
| `lib/affinity/client.ts` | Server-only Affinity API v2 client. Finds the Status, Pass Reason, Pass Date, Deal Lead, Stage and Industry fields by name, and keeps only entries whose status is Passed. |
| `lib/affinity/mock-server.ts` | A fake Affinity that returns our synthetic workspace in **Affinity's real API format** (pagination, field values, auth). |
| `lib/affinity/demo-workspace.ts` | **The synthetic pass log. Product lane: paste the final 30-company CSV here.** |
| `app/api/mock-affinity/[...path]/route.ts` | The same fake over HTTP, for curl: `/api/mock-affinity/v2/lists` with header `Authorization: Bearer demo`. |
| `lib/passlog/*` | The shared `PassLogRow` type, CSV parser, and domain and date clean-up. |

**Modes**
- No `AFFINITY_API_KEY` means **demo mode**: the synthetic workspace. The UI shows "Demo workspace (synthetic data)."
- If `AFFINITY_API_KEY` is set, it means **live mode** against `https://api.affinity.co`. This needs an Affinity Scale, Advanced or Enterprise plan (trials have no API access), and the event rules say no confidential fund data anyway. **Use demo mode today.**

**On stage:** "This uses Affinity's real API format. Here it's running on a demo workspace with synthetic data."

**Output row** (the same for Affinity and CSV): `company_name, domain, pass_date (YYYY-MM-DD), partner, stage_at_pass, sector, pass_reason_text, fund_id, source, source_ref?, pass_date_estimated?`

---

## 7. Data rules (event rules plus our own)

- **Event rule: public or synthetic data only.** No confidential fund, LP or company data without permission.
  - The pass log is **synthetic** (fictional funds, fictional pass notes) about **real companies**, so Akta returns real news.
  - If an investor in the room gives us real pass reasons, we use them **only with explicit permission**, with names hidden.
- **Never show a made-up number as if it's real.** Network numbers are labeled "Demo data" unless they come from data we're allowed to use.
- Every evidence card shows its source, link and date, and the date must be after the pass date.
- Check every result by hand before the demo. Watch for different companies with the same name.
- **All code is written today.** No pre-built projects. Libraries, public APIs, templates and AI coding tools are fine.

---

## 8. How we market it (talking points for everyone)

### "Why is this better than an AI agent?"
- **An agent forgets. SecondLook remembers.** An agent answers when someone thinks to ask. SecondLook keeps a dated record of every "no" and checks it without anyone asking.
- **An agent only knows your fund. SecondLook knows the network.** Your own agent learns from your few hundred passes. SecondLook's agents share what they learn across funds through Roundtable, so it knows which reasons usually come true and how fast.
- **An agent can make things up. SecondLook shows receipts.** The AI only reads and quotes. Fixed rules make the call. Every claim has a dated link, and every AI run is traced and checked in PRISM.
- **An agent is a tool you babysit. SecondLook is a workflow.** Queue, owner, due date, and an approve button. It ends with a meeting booked, not a chat answer.
- If pushed: "Sure, you could hack a version with an agent for one fund, once. You could also run a CRM in a spreadsheet."

### "Are you training an AI model?"
**No. We're training a product, not a model.**
- We use off-the-shelf AI through Nicrron and can swap models any time. When a better model comes out, we get better for free.
- What gets smarter is everything around the model:
  - the list of reason types
  - the rules for what counts as proof for each reason
  - the network's record of which "no" reasons came true
- Every fund that uses it adds outcomes, and the product gets more accurate for every other fund.
- **Analogy:** Waze doesn't win because it has a better map. It wins because every driver reports traffic. Our "drivers" are funds reporting how their no's turned out.
- **Why VCs should like this:** AI models are getting cheaper and more alike every month. A growing pile of real outcomes, built into how funds work, is the hard part to copy. No big spend on training models.

### Lines to use
- Hook: "Your best deal might be one you already said no to."
- Positioning: "Affinity remembers why you said no. SecondLook knows how often that reason turns out wrong."
- Close: "Every fund that joins makes every other fund's no's smarter."

### Words to drop on stage
No "taxonomy," "ReconnectScore," formulas, or "LLM." Say "standard reasons," "the score," and "AI."

### Objections and answers
| They say | We say |
|---|---|
| "Affinity could add this." | "Affinity stores why you said no. To know how often that reason is wrong, you need every other fund's outcomes. Affinity only sees one fund at a time." |
| "Funds won't share their pass lists." | "They don't have to. Their agents share only the reason type and whether it came true. No names." |
| "Partners hate being told they were wrong." | "We don't tell them they were wrong. We tell them the company grew into it." |
| "Small startups aren't in the news." | "Then we say 'insufficient data' honestly and draft a check-in email to the founder." |
| "How do you know the AI isn't making things up?" | "Every run is traced in PRISM, with a rule that every claim must quote its source. Here's v1 breaking it and v2 passing." |
| "The market is small." | "We start with VC because the no's are written down. Angels, accelerators and corporate investors all say 'not yet' too." Keep it short and don't argue. |

---

## 9. Demo script (3 minutes; the video must be 3 minutes or less)

| Time | Beat | On screen |
|---|---|---|
| 0:00 to 0:20 | Hook: Bessemer publicly lists passing on PayPal. Funds say no to almost everything they see, and many of those no's are just "not yet." | Landing page |
| 0:20 to 0:45 | Upload a pass list. Messy notes become standard reasons, each with its network tag. | Upload |
| 0:45 to 1:30 | Hero company: "no product yet, no big customers." Dated Akta evidence. Verdicts flip to Resolved and Partial. | Queue, then brief |
| 1:30 to 1:55 | Brief, then the email. Approve. Owner and due date set. | Brief, email |
| 1:55 to 2:20 | Trust: PRISM view, the same inputs with v1 breaking the quote rule and v2 passing. | PRISM |
| 2:20 to 2:40 | Network screen: "Your own AI only knows your no's. SecondLook's agents learn from every fund." Show "What we share" for 3 seconds. | Network |
| 2:40 to 3:00 | Close lines, plus one sentence naming all four sponsor tools. | Closing slide |

---

## 10. Checklist before submitting (3:45 PM)

- [ ] All four sponsor tools used and named in the demo and on Devpost (Nicrron, akta.pro, PRISM, Roundtable)
- [ ] 50+ PRISM runs, a rule added, and v1 vs v2 shown
- [ ] Upload a CSV and see the ranked queue in under 10 seconds (from cache)
- [ ] Every evidence item has a source, link and a date after the pass
- [ ] Network numbers are real or labeled "Demo data"
- [ ] The email names the resolved reason and needs approval
- [ ] Works with Akta offline (cached fixtures)
- [ ] Repo is public, with no keys committed
- [ ] Deployed on Vercel
- [ ] Video of 3 minutes or less, plus founder brief, uploaded
- [ ] LinkedIn and X posts live, with links on Devpost

## 11. Open questions

- Roundtable: what are the actual API and setup steps? (Read the Notion quick start.)
- Deadline: 4:00 or 4:30? (The Rules page says both. Plan for 4:00.)
