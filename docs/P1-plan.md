# P1 implementation plan

Status: draft for review, no code written yet. Source: `docs/PRD.md` (P1 only).
Baseline checked before planning: `npm run typecheck` clean, `npm test` 97/97 passing.

## 1. What the code looks like today (relevant facts)

- Stack: Next.js 15 App Router (server components + server actions), Drizzle on Neon (HTTP driver, so `db.batch` is the only multi-statement atomic unit), NextAuth (Google), Tailwind 4, Vitest. Schema is applied with `drizzle-kit push`; there is no migrations folder.
- Tables: `assets(type, name, isin)`, `buy_lots`, `sales`, `sale_allocations`, `misc_entries`, `broker_connections`, `user_settings(slab_rate)`. All `money()` columns are `numeric(20,4)`, including qty and unit price.
- `ASSET_RULES` in `taxRules.ts` is keyed by 14 ids and has a `group` string used by the dashboard, holdings and filters.
- Platform is not stored: `platformOf(source)` derives Zerodha / Groww / Other from the lot or sale `source`. `PLATFORMS` is a hard-coded constant in `lib/filters.ts`.
- FIFO: `allocateFifo` / `reallocate` work in the units stored on the lot. `sale_allocations.qty` is in lot units. Holdings cost = remaining qty x (price + fees/qty).
- Buyback exists twice: `sales.is_buyback` (taxed in `salePieces`/`computeRealised`) and `misc_entries.asset_type = 'buyback'` (own cost field). Transactions, Misc and `realisedFilter` each handle both.
- Nav is hard-coded in `components/Nav.tsx` (Home, Holdings, Gains, Misc + More). Settings is a sidebar page and the mobile avatar links straight to it.
- Type sizes: about 130 ad-hoc `text-*` classes (`text-sm` 62, `text-xs` 32, `text-[13px]` 10, plus 11/15/17/22/26px one-offs).
- Number formatting: `format.ts` has `formatINR` (2 dp), `formatINRWhole`, `formatQty` (6 dp). The dashboard uses `formatINR` for headline KPIs, which is not what PRD 5.3 C says.

## 2. Decisions that change the design (please confirm or correct)

| # | Issue | What I will do unless told otherwise |
|---|---|---|
| D1 | The roadmap says "platform stored on each asset", but PRD 1.2 lists "an asset held on two platforms is a single row" as a problem. | Store `platform` on **`buy_lots`**, not on `assets`. An asset's platforms are the set of its lots' platforms. A sale inherits the platform of the lots it consumed. This also keeps ISIN-based sync and import dedupe working. If you want it on the asset, a two-platform holding must become two asset rows. |
| D2 | Which database does `db:push` hit? The repo has one `DATABASE_URL`. | I will not run `db:push` until you tell me it points at a dev/branch DB or that you have a Neon backup. Schema changes are written to be additive. |
| D3 | Old misc buyback rows have a user-typed cost but no lot or asset, so they cannot become a real sale without inventing data. | A one-off script turns each into an asset "Share buyback (legacy)" (equity), one synthetic lot with qty 1 at the typed cost, dated 400 days before the entry for LTCG or 1 day before for STCG, and one buyback sale. Before doing this I will run a count; if it is 0 or a handful I will ask you to re-enter them instead. |
| D4 | 4.2 says buyback is a sale, but 6.4 still lists a "Buyback" chip under Misc. | Buyback shows in **Sales** (Gains) and Activity with a Buyback chip. The Misc segment has Dividend, F&O, Interest, Other only. |
| D5 | "Current / Invested" toggle (6.3) and P/L need prices, which are P2. | Build the sort/group/filter controls. Do not render the toggle or any P/L until prices exist. Primary number on a card is invested cost, labelled as such. |
| D6 | Symbol / ISIN / scheme search autofill (3.1) needs an instrument data source, which is undecided (Q4). | P1 form is plain name + optional ISIN. No autofill. Sector, market cap and ETF underlying stay empty until P2. |
| D7 | Gold fund. `gold_etf` is one id, PRD puts Gold ETF in Stocks & ETFs and Gold fund in Mutual Funds. | Everything under `gold_etf` maps to Stocks & ETFs, exposure Gold. A gold mutual fund has the same tax rule, so the user can add it as `gold_etf`; the category label will say "Gold ETF / fund". No new tax id. |
| D8 | Whole-share rule (5.3 D) vs consolidation ratios that produce fractions (3:1 on 10 shares). | A split or consolidation that leaves a fraction is rejected with a message asking the user to record the cash-settled part as a sale. No automatic cash settlement. |
| D9 | The "quantity jumped, was this a bonus?" suggestion for Kite sync (4.2). | Not in the 4.3 acceptance criteria. Deferred to the end of slice 3 as optional, will be listed as unfinished if I do not reach it. |
| D10 | Verifying UI needs a login (Google OAuth) and a database. | I need either a test login/seed DB or your OK to build a dev-only seeded mode. Until then I verify with typecheck, lint, tests and `next build` only, and will say UI was not checked in a browser. |

### Decisions made (2026-10-28)

- **D1:** platform on `buy_lots` (my call, as delegated).
- **D2:** no backup exists; schema changes are additive, so they go straight to the current DB. Optional safety net: a Neon branch (Neon console > Branches > Create branch from main, about a minute), which is a point-in-time copy.
- **D4:** buyback lives under Sales only.
- **D7 (revised):** no separate "Gold ETF / fund" entry anywhere in the category list. Physical gold, silver and digital gold are **Metals**. A gold/silver ETF is only a sub-type ("Commodity ETF") inside Stocks & ETFs, so its tax rule still applies. The `gold_etf` id stays internal.
- **D10 (revised):** UI is designed in `mockup/p1.html` first. Real UI slices (5 to 8) wait for your UI direction after you review the mock. Non-UI slices (1 to 4 logic) do not depend on it.

## 3. Data model changes (all additive)

1. `buy_lots.platform text not null default 'Other'`. Backfill from `source` (`zerodha*`/`kite_sync` -> Zerodha, `groww*` -> Groww). Kite sync and import write it explicitly.
2. New `user_platforms(user_id, name, kind)` (kind: broker, bank, self). Seeded per user on first read with Zerodha, Groww, Other. Replaces the hard-coded `PLATFORMS`.
3. `assets`: add `tags text[]`, `notes text`, `details jsonb` for category-specific optional fields (FD rate/maturity, bond coupon, SGB series, folio, etc.). No typed column per field in P1.
4. Precision: `buy_lots.qty`, `buy_lots.unit_price`, `sales.qty`, `sales.price`, `sale_allocations.qty` widen to `numeric(20,8)`. This is a lossless `ALTER ... TYPE`.
5. New `corporate_actions(id, user_id, asset_id, type, date, ratio_num, ratio_den, amount, tds, note, created_at)`; types `split`, `bonus`, `dividend` in P1 (`buyback` is a sale, not an action).
6. `buy_lots.event_id uuid null references corporate_actions(id) on delete cascade`, so a bonus event owns the zero-cost lot it created and reversing the event removes it.
7. Drop later (after the migration is verified, not in P1): `misc_entries` rows with `asset_type='buyback'`, and the `is_buyback` branch in `MiscEvent`.

`ASSET_RULES` gains `category` and `exposure` per id (PRD 2.3 table). `group` stays for one release and is re-pointed to `category` by a helper, so nothing breaks mid-way. Tax fields are not touched.

## 4. Corporate-action design (the riskiest part)

- **Split / consolidation (ratio n:d).** Lots stay as stored. A pure function `applySplits(lots, sales, allocations, actions)` returns lots, sales and allocations normalised to current units: lot qty x factor, unit price / factor, for every split dated after the lot's buy date; sale and allocation qty x factor for splits dated after the sale. Buy dates never change, so holding period and tax are unchanged. Total cost is unchanged by construction.
- `computeRealised` and `computeHoldings` take the normalised inputs. Display of a historical sale shows its original quantity (kept alongside).
- Rule for new sales after a split: entered in current units, stored as entered; factor for events after the sale date is 1 so nothing is scaled.
- **Bonus.** Creates a real lot (`unit_price = 0`, `buy_date = bonus date`, `event_id`) with qty = quantity held on the record date x ratio. Holding period starts at the bonus date.
- **Dividend.** Row with amount and optional TDS, attached to the asset. Enters `computeRealised` as a misc-type event taxed at slab rate x (1 + cess), not set off against capital losses. Shown in the holding Events tab, Gains > Misc and the period totals.
- **Buyback.** One form on the sell flow: tendered qty and accepted qty. Only accepted qty creates the sale (`is_buyback = true`). Existing date rule (1 Oct 2024) stays in `gains.ts`.
- Every event is reversible: delete the event and (for bonus) its lot; FIFO is re-run with the existing `reallocate` + `allocationStatements`, rejecting the change if it would leave a sale uncovered (same error path as editing a lot).

## 5. Slices, files, tests

Each slice: one commit, `typecheck` + `lint` + `test` green, stop for review.

| # | Slice | Main files | Tests added |
|---|---|---|---|
| 1 | Foundations | `taxRules.ts` (category, exposure), `db/schema.ts`, `domain/platform.ts`, `lib/validation.ts` (per-category limits, paste cleaning, "Up to N decimals"), `lib/filters.ts`, `features/holdings/actions.ts`, `features/sales/actions.ts`, `features/kite/actions.ts`, `features/import/plan.ts` + parsers (flag fractional qty), `scripts/` backfill SQL | Type to category/exposure mapping (all 14 ids), input limits per field, paste cleaning, import rejects fractional share |
| 2 | Formatting + type scale | `lib/format.ts` (whole, 2 dp, compact L/Cr, qty by category, price 2-4/8 dp, percent 1 dp, CSV), `globals.css` (`t-*` utilities) | Every row of the PRD 5.3 C table, negatives, zero, rounding, L/Cr thresholds |
| 3 | Corporate actions | `domain/corporateActions.ts` (new, pure), `domain/gains.ts`, `portfolio/data.ts`, `features/events/*` (new), `features/sales/*` (buyback form), `features/misc/*`, migration script for old buyback rows | 4.3 criteria 1 to 4 verbatim, split+sale ordering, reversal, uncovered-sale rejection, dividend tax, pre/post 1 Oct 2024 buyback |
| 4 | Add-investment form | `features/holdings/AddInvestment.tsx`, `AddBuyForm.tsx`, `actions.ts`, `components/fields.tsx` | Required-field schema per category |
| 5 | Navigation, Add sheet, avatar menu | `components/Nav.tsx`, `(app)/layout.tsx`, new `/gains`, `/profile/*` routes, redirects from `/realised`, `/misc`, `/settings`, `/realised/export` | Route redirect table, nav config |
| 6 | Dashboard | `(app)/dashboard/page.tsx`, `features/dashboard/*`, eye-icon provider (cookie so it does not flash on first paint) | Mix by platform/category/exposure sums to the total, time-basis labels |
| 7 | Holdings + detail | `(app)/holdings/*`, `HoldingsGrid.tsx`, `FilterBar` (exposure, tag), `lib/sort.ts` | Group-by subtotals, sort keys, filter URL round trip |
| 8 | Gains + Activity | `(app)/gains`, `(app)/transactions`, `features/reports/*`, export route | Month grouping and net cash flow, export follows filters |

URL plan: keep `/transactions` (labelled Activity) and `/holdings`; add `/gains`; redirect old paths so bookmarks work.

## 6. Risks

1. **Corporate actions touch FIFO and tax.** A bug here produces wrong tax silently. Mitigation: pure functions, tests first from the 4.3 numbers, no change to `settleYear`.
2. **Schema push on a shared DB** (D2). Mitigation: additive changes only, backfill script is idempotent, no push without your go.
3. **Quantity precision change.** Widening is lossless, but `Number()` of 8-decimal values is fine in JS doubles only up to about 15 significant digits; with qty up to 1e10 and 8 decimals that is 19 digits. Mitigation: cap qty at 1e10 for categories with fewer than 8 decimals and keep totals rounded per row as PRD 5.3 A says. I will add a test for the extreme crypto case.
4. **Existing fractional stock quantities** may already be in the DB. The new rule rejects new ones only. I will run a query and report any existing rows rather than altering them.
5. **Mixed-meaning KPI row** is fixed on the dashboard, but filter logic is duplicated across dashboard, realised, misc and transactions pages today. Slices 6 to 8 will move it into one shared helper; any page I do not reach keeps working on the old one.
6. **Type-scale rollout** is by screen, so for a while some screens will use `t-*` and others the old classes. Accepted by the PRD.
7. **No browser check without D10.** UI slices (5 to 8) cannot be called verified until that is solved.

## 7. Out of scope for this run

P2 and P3 items, PRD section 10, prices and P/L, Groww web sync, family accounts, the Kite quantity-jump suggestion (D9, unless time), symbol autofill (D6).
