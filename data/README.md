# Demo data (Part B)

**Synthetic data.** Public or synthetic data only, per the event rules.

- The **fund** ("Harbor Street Ventures"), **partner names**, **pass dates** and **pass reasons** are all fictional.
- The **companies are real** so that akta.pro returns real news and company data. Nothing here asserts a real fund actually passed on these companies.

## Files

| File | What it is | Consumed by |
|---|---|---|
| `pass-ledger.csv` | Canonical 30-company pass ledger (snake_case columns = `PASS_LOG_COLUMNS`). | `scripts/prefetch.ts`, the document-upload path, and the simulated Affinity workspace. |
| `thesis.json` | The demo fund's thesis (sectors, stages, geos, keywords, max round size). | Conviction scoring (thesis fit), comps. |
| `fixtures/` | Frozen API + LLM results, written by `scripts/prefetch.ts`. The deployed app reads these (Vercel FS is read-only at runtime). | `/api/deals`, `/api/deal/[id]`. |

## Keeping the ledger in sync

`pass-ledger.csv` is the single source of truth for the demo deals. The simulated
Affinity workspace in `lib/affinity/demo-workspace.ts` (`DEMO_PASS_LOG_CSV`) mirrors
the same rows so the "Connect Affinity" path shows the same companies. If you change
one, change the other.

## Hero deal

Row 1 (**Decagon**) is the hero: passed for "no enterprise logos yet", intended to
flip to **De-risked** on a dated, public enterprise partnership after the pass date.
**Verify the hero's proof in the Akta Playground before the demo** — the exact event
and its date must come from real Akta/HN data, not from this file.
