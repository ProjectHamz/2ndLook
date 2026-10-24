# SecondLook

**SecondLook tells a fund when the reason it said no has gone away, with dated proof, and learns across funds which kinds of "no" turn out wrong.**

Built at Deal Flow: NYC's First VC Hackathon @ Betaworks, Oct 24, 2026. Track 1: Sourcing. Entering Wokelo's Best Use of External Data.

> The team's to-do list, deadlines, sponsor setup and demo script are in **[REQUIREMENTS.md](REQUIREMENTS.md)**.

---

## The problem

Funds say no to almost everything they see. The average VC firm screens about 200 companies a year and makes about 4 investments (Gompers et al., *Journal of Financial Economics*, 2020). Many of those no's are timing calls, like "pre-product" or "no enterprise customers yet." The reasons sit in a CRM field nobody re-reads, so funds miss companies that grew into exactly what they asked for.

## What it does

A fund connects its Affinity (or uploads a CSV of its passes). For each company, SecondLook gives:

1. A verdict on each original objection: **Resolved**, **Partial** or **Not yet**.
2. The dated evidence behind each verdict, with a quote and a link.
3. A ranked queue of who to call back.
4. A one-page brief for the partner (old reason on the left, new proof on the right).
5. A reconnect email with a named owner and due date, sent only after a human approves it.

Across funds, it learns which reasons usually come true and how fast. For example: "Across the network, 'no product yet' came true for [X] in 10 within [Y] months."

## Positioning

**Affinity remembers why you said no. SecondLook knows how often that reason turns out wrong.**

- **Better than an AI agent:**
  - It remembers; an agent only answers when asked.
  - It learns across funds; an agent only knows yours.
  - It shows receipts; an agent can make things up.
  - It ends in a booked meeting, not a chat reply.
- **We train a product, not a model.** We use off-the-shelf AI through Nicrron and can swap models any time. What gets smarter is the reason categories, the rules for what counts as proof, and the network's record of outcomes. Think Waze: it wins because drivers report traffic, not because it has a better map.

## Users

| Role | Who | What they need |
|---|---|---|
| User | Associate or principal at a seed to Series A fund | A short list of passes worth revisiting, with proof |
| Decider | The partner who made the original pass | A 2-minute brief in their own words, then a yes or no |
| Buyer | Managing partner, or the fund's platform or data lead | More good deals from data the fund already owns |

## How it works

```
Connect Affinity (or upload a CSV)
  -> 1. Pull passed companies + pass reasons; normalize domains and dates
  -> 2. AI turns each free-text reason into 1 to 3 standard objections   (Nicrron, traced in PRISM)
  -> 3. Resolve each company                                               (akta.pro company search)
  -> 4. Pull evidence since the pass date                                  (akta.pro news + sections, SEC EDGAR Form D)
  -> 5. AI labels each item supports / contradicts / irrelevant, with a verbatim quote   (Nicrron, traced in PRISM)
  -> 6. Fixed rules compute verdicts and the score                         (pure, unit-tested functions)
  -> 7. Queue, brief, draft email, human approval
  -> 8. Anonymized outcomes shared between fund agents                     (Roundtable)
```

The AI only reads and quotes. Fixed rules decide every verdict.

## Objection types

| Code | Example reason | Evidence that resolves it |
|---|---|---|
| PRE_PRODUCT | "pre-product," "just a deck" | Product launch news after the pass date, or a live product |
| NO_ENTERPRISE_CUSTOMERS | "no enterprise logos" | A partnership, a named enterprise customer, or an enterprise segment in the customer profile |
| TOO_EARLY_REVENUE | "too early on revenue" | A new equity raise or a Form D filing as a proxy |
| TEAM_GAP | "no technical cofounder" | A CTO or VP Eng hire, or a management change |
| GTM_UNPROVEN | "no distribution" | Partnerships, channel deals, launch coverage |
| MARKET_SIZE | "market too small" | Judgment call: at most Partial, flagged for a human |
| ROUND_DYNAMICS | "valuation too high," "round full" | A new round announced (news or Form D) |

## Scoring

**Evidence strength (per item):**
- 1.0: the main-company match and the event type maps to the objection.
- 0.6: mention-only match, or the AI alone made the mapping.
- 0: published before the pass date, so it's discarded.

**Verdict per objection:**
- Resolved: at least one 1.0 item labeled "supports," and no newer "contradicts."
- Partial: the best supporting item is 0.6.
- Insufficient data: zero news items.
- Judgment call: MARKET_SIZE, flagged for a human.
- Not yet: everything else.

**ReconnectScore** = 0.5 × Resolution + 0.3 × ThesisFit + 0.2 × Momentum

These weights are starting assumptions, not validated. The UI always shows the breakdown, never a single magic number. A stage-drift flag marks companies whose new round is too big for the fund.

## Sponsor tools (all four required)

| Tool | Role in SecondLook |
|---|---|
| **Nicrron** | AI gateway for every AI call |
| **akta.pro by Wokelo** | Company search, news since the pass date, company sections. Our main evidence source. |
| **PRISM by Block Convey** | Traces every AI run. Enforces the rule "every claim must quote its source," with v1 vs v2 shown on the same inputs. |
| **Roundtable** | Lets fund agents share anonymized outcomes, which powers the network layer |

Also used: SEC EDGAR (Form D filings).

## Data and privacy

- Public or synthetic data only. The demo pass log is synthetic (fictional funds and notes) about real companies, and it's labeled on screen.
- **Shared across the network:** reason type, date, and whether it came true.
- **Never shared:** company names, fund names, or notes.
- No LinkedIn scraping.

## Competition

| Product | What it does | The gap SecondLook fills |
|---|---|---|
| Affinity | Records why you passed; flags untouched companies | No matching of new evidence to the specific objection |
| Harmonic | Saved searches and company change signals | Generic signals, not "your reason is resolved" |
| Specter | News alerts with importance scores | Doesn't know your pass log |
| Dealtable | Remembers past pitches and pass reasons, monitors signals | No public evidence of objection-level verdicts |

## Business model (a hypothesis, not validated)

- **Price:** $400 to $800 per fund per month, well below Harmonic's reported ~$25k/year minimum.
- **Data cost:** watching 500 passed companies weekly costs about $30/month in Akta credits.
- **Market:** 2,984 US VC firms at the end of 2025 (NVCA 2026 Yearbook). Angels, accelerators and corporate investors are later markets.
- **First customers:** judges' funds, VC Lab emerging managers, and an Affinity CSV import as the way in.

## Stack

Next.js and TypeScript, Tailwind and shadcn/ui, a SQLite response cache with fixture fallback, Nicrron for AI, deployed on Vercel.

## Team lanes

| Lane | Owns |
|---|---|
| A: Data and Akta | Akta client, cache, throttle, EDGAR, prefetch and fixtures |
| B: AI and rules | Objection parsing, evidence labeling, verdict and score engine, PRISM runs |
| C: Frontend and demo | Upload, queue, brief, email, network screen, demo |
| D: Product | Pass-log CSV, fund theses, founder brief, interviews, Devpost submission |
