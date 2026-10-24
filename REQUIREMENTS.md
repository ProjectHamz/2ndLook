# SecondLook: what we have to do today

Deal Flow: NYC's First VC Hackathon, Oct 24, 2026.
One line: **SecondLook tells a fund when the reason it said no has gone away, with dated proof, and learns from every fund which kinds of "no" turn out wrong.**

---

## 1. Prize eligibility (non-negotiable)

Projects that don't use **all four** of these are not eligible for **any** prize.

| Tool | What it is | How SecondLook uses it | Status |
|---|---|---|---|
| **akta.pro** | Company data, news and signals API | Find the company, then pull news since the pass date (launches, partnerships, funding, hires). This is our main evidence source. | [ ] |
| **PRISM by Block Convey** | AI model evaluation: bias checks, explainability, audit reports ([Product Hunt](https://www.producthunt.com/posts/prism-by-block-convey), prism.blockconvey.com) | Audit the AI step that labels evidence. Show an "Audited by PRISM" badge and a link to the report on every verdict. Pitch: "every verdict is explainable and audited." | [ ] |
| **Roundtable** | We *think* this is Roundtable (YC), "Proof of Human" bot detection, now at poh.org. One script tag returns a human or bot risk score. **Confirm with organizers.** | Put it on the pages where people contribute data (upload a pass list, approve an email, share to the network), so network data only comes from real humans, not bots or scripts. | [ ] |
| **Nicrron** | **Unknown. Could not find it online.** Code: `BETAWORKS250`. Check the event guidebook (Notion link in the Luma blast) or ask the organizers. | TBD once we know what it does. | [ ] |

**Action now:** one person confirms what Roundtable and Nicrron are, gets keys and credits, and updates this table.

---

## 2. Schedule (confirm at the desk)

| Time | What |
|---|---|
| 10:30 to 4:30 | Hacking (per Luma) |
| 4:30 to 5:30 | Judging |
| 5:30 to 6:00 | Demos and winners |

Our old notes said "submit 5:30" (Devpost). **Luma says judging starts 4:30. Plan for 4:30.**

**Judging:** business and code count equally (per the organizers' track notes). One judge wants "both slick code and a real business." **Submission:** done through a process the organizers announce today, not published yet.

- **3:00:** freeze features. Bug fixes only after this.
- **3:30:** record the backup demo video.
- **4:15:** submitted, deployed, rehearsed.

---

## 3. What we're building

### Core (from the PRD)
1. Upload a pass list (CSV: company, domain, pass date, partner, stage, sector, reason).
2. AI turns each messy reason into 1 to 3 standard reasons (no product yet, no big customers, too early on revenue, team gap, no distribution, market too small, round dynamics).
3. Akta finds the company and pulls news since the pass date. EDGAR Form D checks for new funding.
4. AI labels each piece of evidence (supports, contradicts, irrelevant) **and must quote it word for word**.
5. Fixed rules (not the AI) decide each verdict: Resolved, Partial, Not yet, Insufficient data, Judgment call.
6. Ranked queue, one-page brief (old reason on the left, dated proof on the right), and a draft email that needs a human to approve it.

### New: the network layer (this answers "feature" and "agent")
7. **Reason tag:** next to every reason, show "Across the network, this came true for [X] in 10, usually within [Y] months."
8. **Network screen:** one bar chart showing each type of "no" and how often it came true.
9. **"What we share" panel:**
   - Shared: reason type, date, and whether it came true.
   - Never shared: company names, fund names, or notes.
10. **PRISM badge** on verdicts and **Roundtable check** on the upload, approve and share actions.

### Out of scope
Auth, sending real email, CRM write-back, LinkedIn (no scraping), scheduled jobs.

---

## 4. Data rules (judges will check)

- **Never show a made-up number as if it's real.** Network numbers come from real pass lists collected today ("Network: [N] passes from [M] funds collected today"), or they're labeled "Demo data."
- The synthetic pass log keeps its "Synthetic pass log for demo" banner.
- Every evidence card shows its source, link and date, and the date must be after the pass date.
- Real names from investors in the room go on stage only with their permission, hidden by default.
- Check every real result by hand before the demo. Watch for different companies with the same name.

---

## 5. How we market it (talking points for everyone)

### "Why is this better than an AI agent?"
- **An agent forgets. SecondLook remembers.** An agent answers when someone thinks to ask. SecondLook keeps a dated record of every "no" and checks it without anyone asking.
- **An agent only knows your fund. SecondLook knows the network.** Your own agent learns from your few hundred passes. SecondLook learns from every fund's, so it knows which reasons usually come true and how fast.
- **An agent can make things up. SecondLook shows receipts.** The AI only reads and quotes. Fixed rules make the call. Every claim has a dated link, and PRISM audits the AI step.
- **An agent is a tool you babysit. SecondLook is a workflow.** Queue, owner, due date, and an approve button. It ends with a meeting booked, not a chat answer.
- If pushed: "Sure, you could hack a version with an agent for one fund, once. You could also run a CRM in a spreadsheet."

### "Are you training an AI model?"
**No. We're training a product, not a model.**
- We use off-the-shelf AI and can swap it any time. When a better model comes out, we get better for free.
- What gets smarter is everything around the model:
  - the list of reason types
  - the rules for what counts as proof for each reason
  - the network's record of which "no" reasons came true
- Every fund that uses it adds outcomes, and the product gets more accurate for every other fund.
- **Analogy:** Waze doesn't win because it has a better map. It wins because every driver reports traffic. Our "drivers" are funds reporting how their no's turned out.
- **Why VCs should like this:** AI models are getting cheaper and more alike every month. A pile of real outcomes, built into how funds work, is the part that keeps growing and is hard to copy. No big spend on computers to train models.

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
| "Funds won't share their pass lists." | "They don't have to. They share only the reason type and whether it came true. No names." |
| "Partners hate being told they were wrong." | "We don't tell them they were wrong. We tell them the company grew into it." |
| "Small startups aren't in the news." | "Then we say 'insufficient data' honestly and draft a check-in email to the founder." |
| "The market is small." | "We start with VC because the no's are written down. Angels, accelerators and corporate investors all say 'not yet' too." Keep it short and don't argue. |

---

## 6. Demo script (3 minutes)

| Time | Beat | On screen |
|---|---|---|
| 0:00 to 0:20 | Hook: Bessemer publicly lists passing on PayPal. Funds say no to almost everything they see, and many of those no's are just "not yet." | Landing page |
| 0:20 to 0:50 | Upload a pass list. Messy notes become standard reasons, each with its network tag. | Upload |
| 0:50 to 1:40 | Hero company: "no product yet, no big customers." Dated Akta evidence. Verdicts flip to Resolved and Partial. PRISM badge visible. | Queue, then brief |
| 1:40 to 2:10 | Brief, then the email. Approve (Roundtable check). Owner and due date set. | Brief, email |
| 2:10 to 2:35 | Network screen: "Your own AI only knows your no's. SecondLook knows everyone's." Show "What we share" for 3 seconds. | Network |
| 2:35 to 3:00 | Close lines, plus how we use all four sponsor tools in one sentence. | Closing slide |

Backup video of this exact path recorded by **3:30**.

---

## 7. Checklist before judging

- [ ] All four sponsor tools used and visible in the demo (akta.pro, PRISM, Roundtable, Nicrron)
- [ ] Upload a CSV and see the ranked queue in under 10 seconds (from cache)
- [ ] Every evidence item has a source, link and a date after the pass
- [ ] Network numbers are real or labeled "Demo data"
- [ ] The email names the resolved reason and needs approval
- [ ] Works with Akta offline (cached fixtures)
- [ ] Backup video recorded
- [ ] Deployed link plus public repo plus submission text done

## 8. Open questions

- What is Nicrron, and how is it meant to be used?
- Is "Roundtable" the Proof of Human bot check (poh.org)? Do they have a hackathon key?
- Does PRISM have an API, or do we upload a report from their site?
- Where do we submit (Devpost or the organizers), and by when?
