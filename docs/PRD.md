# Global Fin: Product Requirements Document

Status: draft v1 · Owner: Rishab Gupta · Date: 2026-10-28
Platforms: responsive web app (desktop sidebar, mobile bottom tabs)

---

## 0. How to read this

- Section 1 is the vision and what the code does today, so we agree on the starting point.
- Sections 2 to 5 are the product decisions: categories, data capture, stock events, KPIs and number precision (5.3).
- Section 6 is every tab, section by section, with desktop and mobile behaviour, plus colour and type standards (6.8).
- Section 7 is the phased roadmap. Section 8 lists open questions that need your call.

Groww note: Groww findings in section 9 come from two third-party case studies (a Behance product breakdown, Jan 2026, and a Medium heuristic review, Jul 2023). They are student write-ups with dark-mode screenshots, not Groww documents, and the Groww web app is not covered. Holdings-row columns on Groww are marked **(verify)** because the screenshots blur or omit them.

---

## 1. Vision and current state

### 1.1 Vision
One place for an Indian retail investor to see:
1. **Mix**: what share of the money sits in which category and on which platform.
2. **Realised gain** for a chosen period.
3. **Tax** on that gain.
4. **Profit after tax**.

This is a **tracker, not a trading app**. The user already bought and sold elsewhere (Zerodha, Groww, a bank). We record it, show what is held now, and show what was earned and taxed. We do not place orders, recommend, or show market-discovery content.

Everything in the app serves one of those four. Anything that does not is secondary and lives one tap deeper.

### 1.2 What exists today (from the code)

| Area | Today | Problem |
|---|---|---|
| Categories | 14 asset types in `taxRules.ts`, rolled into 7 groups (Equity, Debt, Fixed income, Real estate, Gold, Crypto, Other) | Groups follow tax rules, not how users think. Stocks and equity MFs share "Equity". Debt MF and bonds are "Debt", FD is "Fixed income". Gold ETF, physical gold and SGB are one group though they are bought in different places. |
| Platform | Derived from the trade source (`platformOf`): Zerodha, Groww or Other. Not stored on the asset. | A manual entry is always "Other". The user cannot say "this FD is in HDFC". An asset held on two platforms is a single row. |
| Valuation | Cost only. No price, no market value. | "Current mix" is a mix of cost, not of value. There is no unrealised P/L, which is the first number any holdings screen shows. |
| Dashboard | 4 KPIs (invested, realised, tax, post-tax), gain-by-year chart, invested-by-class donut, period and filter bar | "Invested" is as of today but the other three follow the period. The same card row mixes two time meanings. |
| Holdings | KPI cards per holding: name, type, platform badges, invested, qty, avg cost, portfolio %, Details/Sell. Sort, search, filters, Edit mode with bulk delete. | No value, no P/L, no sector. Good bones. |
| Misc P/L | Own tab. Table of one-off gains/losses (dividends, F&O) and buyback entries. | It is a primary mobile tab although it is rarely used. Buybacks live here and also as a flag on sales. |
| Transactions | Table of buys, sells, misc, buybacks. Hidden under "More" on mobile. | The most-used history is the hardest to reach on mobile. |
| Detail | `/holdings/[assetId]`: 4 KPIs, purchases table, sales table | Works. Missing events, charts, notes. |
| Profile | Avatar goes straight to Settings. Settings has slab rate, tax rules table, Kite connection, account ID, About. | One long page. No profile or preferences structure. |
| Corporate actions | Only buyback, in two parallel forms | No split, bonus, dividend, rights, demerger, merger. |
| Fixed income | FD/RD stored as qty 1 with maturity amount as the sale price | No rate, no maturity date, no interest accrual. |

---

## 2. Investment categories

### 2.1 Principle
Classify by **where and how the user manages it**, not by tax rule. Tax treatment becomes a hidden **sub-type** that the app derives. The user picks a category, then a short sub-type list.

Three separate dimensions, never mixed in one list:

| Dimension | Question it answers | Example values |
|---|---|---|
| **Category** | What is it, and where do I manage it? | Stocks & ETFs, Mutual Funds, … |
| **Platform** (where held) | Which account holds it? | Zerodha, Groww, HDFC Bank, Locker |
| **Exposure** (derived) | What is my money really exposed to? | Equity, Debt, Gold, Real estate, Crypto |

Exposure is derived from category and sub-type. Gold ETF is in category Stocks & ETFs but has exposure Gold. This keeps the user's mental model (broker accounts) and still answers "how much gold do I own in total?".

### 2.2 Proposed categories

| # | Category | Includes | Managed from | Tax sub-type examples |
|---|---|---|---|---|
| 1 | **Stocks & ETFs** | Listed shares, equity ETFs, gold/silver ETFs, international ETFs, REITs and InvITs | Stock broker (demat) | Equity, Gold/silver ETF, Debt ETF, REIT/InvIT |
| 2 | **Mutual Funds** | Equity, hybrid, debt, index, FoF, gold/silver funds | Broker, AMC, MF app | Equity MF, Debt MF, Gold fund |
| 3 | **Fixed Deposits** | Bank and corporate FD, RD | Bank | FD, RD |
| 4 | **Bonds** | One bond type only: G-Sec, corporate, tax-free, SGB-like debt. Listed or unlisted is a field, not a type. | Broker or RBI Retail Direct | Listed, Unlisted |
| 5 | **Metals** | Physical gold and silver (coin, bar, jewellery), digital gold, **Sovereign Gold Bond** | Jeweller, locker, app, demat | Physical/digital, SGB |
| 6 | **Real Estate** | Land, flat, house, commercial | Self | Land/property |
| 7 | **Crypto** | Coins and tokens | Crypto exchange or wallet | VDA |
| 8 | **Govt schemes** | PPF, EPF, NPS, SSY, post-office schemes | Bank, EPFO, post office | Exempt, NPS |
| 9 | **Other** | Anything else | Any | Generic |

Decisions inside that list:
- **Gold ETF goes under Stocks & ETFs**, as you suggested, because the user buys it from the stock broker. The Gold exposure view still counts it.
- **SGB goes under Metals** because users think of it as gold, even though it sits in demat. Alternative: put it in Bonds. See open question Q2.
- **RD merges into Fixed Deposits** with a sub-type. Same bank, same logic, one fewer category.
- **PPF/EPF** get their own small category because they are tax-exempt and mostly passive. They are not a "bond" or "FD" to the user.

### 2.3 Mapping from today's types

| Today (`AssetTypeId`) | New category · sub-type |
|---|---|
| equity | Stocks & ETFs · Equity |
| equity_mf | Mutual Funds · Equity MF |
| debt_mf | Mutual Funds · Debt MF |
| bond_listed, bond_unlisted | Bonds · listed flag |
| fd, rd | Fixed Deposits · FD or RD |
| ppf_epf | Govt schemes |
| land | Real Estate |
| gold_physical | Metals · Physical/digital |
| gold_etf | Stocks & ETFs · Gold ETF (Gold fund goes to Mutual Funds) |
| sgb | Metals · SGB |
| crypto | Crypto |
| other | Other |

Migration: the tax engine (`ASSET_RULES`) stays keyed by the existing 14 ids. Add `category` and `exposure` fields to each rule and re-point the UI "group" to `category`. No data migration is needed for existing rows. Splitting equity from gold ETF already works through the type id.

---

## 3. Information to capture when adding an investment

### 3.1 Principles
- Ask only what a later feature needs: tax, valuation, filtering, or reminders.
- Required fields are few. Everything else is optional and can be filled later from the holding detail.
- Autofill from a symbol/ISIN/scheme-code search where possible (stocks, ETFs, MFs, bonds). The user types a name and picks a result. This also gives sector and exposure for free.

### 3.2 Common fields (all categories)

| Field | Required | Why |
|---|---|---|
| Category and sub-type | Yes | Tax rule, valuation method |
| Name | Yes | Display. Search result for listed assets. |
| **Platform / where held** | Yes (default from last use) | Platform filter and mix. Dropdown of Zerodha, Groww, other brokers, banks, "Self/locker", plus add-your-own. |
| Account nickname | No | Distinguish two demat accounts or family members |
| Date | Yes | Holding period, FY |
| Quantity and price (or amount) | Yes | Cost basis |
| Fees and charges | No (default 0) | Cost basis and net gain |
| Notes and tags | No | Personal grouping (e.g. "Retirement", "Kid's fund") |

### 3.3 Category-specific fields

| Category | Required | Optional but useful (why) |
|---|---|---|
| **Stocks & ETFs** | Symbol or ISIN, exchange | Sector (auto), market-cap bucket (auto), ETF underlying: gold, silver, index, international (exposure), SIP/dividend flags |
| **Mutual Funds** | Scheme (AMFI code or ISIN), units, NAV, date | Plan: Direct or Regular. Option: Growth or IDCW. Fund type: equity, debt, hybrid (decides tax). Folio number. SIP flag with day and amount. |
| **Fixed Deposits** | Bank, principal, interest rate, start date, maturity date | Compounding (quarterly, cumulative), payout type, TDS applied, auto-renew. RD also needs instalment amount and day. |
| **Bonds** | Issuer and ISIN, face value, qty, price, maturity date | Coupon rate and frequency, listed or unlisted (tax), rating, put/call date, YTM at buy |
| **Metals** | Metal (gold/silver), form (physical, digital, SGB), weight in grams, price | Purity (22K/24K), making charges, GST, storage place. SGB also: series, issue price, maturity date, RBI interest. |
| **Real Estate** | Type, name, location, purchase price, date | Registration and stamp duty (add to cost), improvement spend, area, ownership share %, rental income, linked loan, current manual valuation with date |
| **Crypto** | Coin, exchange, qty, INR price, date | TDS 1% deducted (Sec 194S), wallet or exchange name |
| **Govt schemes** | Scheme, opening balance, date | Contribution schedule, yearly interest, maturity date |

### 3.4 What this lets the user ask later
- "What do I hold on Zerodha?" Filter by platform.
- "How much in banking-sector stocks?" Filter by sector, stocks only.
- "Which FDs mature in the next 90 days?" Maturity date, plus a reminder.
- "How much gold exposure in total?" Exposure view.
- "What is my tax for FY?" Sub-type and holding period.

---

## 4. Stock events (corporate actions)

### 4.1 What matters
A stock holding changes without a user trade. Missing these gives wrong quantity, cost and tax.

| Event | Effect on holding | Effect on tax | Priority |
|---|---|---|---|
| **Buyback** (tender) | Accepted shares leave. Rejected shares stay. | From 1 Oct 2024 proceeds are dividend at slab rate. Cost becomes a capital loss. Before that, tax-free. | P1 |
| **Dividend** | None | Dividend income at slab rate. TDS 10% above ₹5,000/yr. | P1 |
| **Stock split / consolidation** | Qty multiplies, unit cost divides. Buy date unchanged. | None | P1 |
| **Bonus issue** | Qty up, new shares cost ₹0. Holding period starts at bonus date. | Cost of old shares unchanged. New shares sold = full proceeds as gain. | P1 |
| **Rights issue** | New lot at rights price on allotment date | Normal | P2 |
| **Demerger / spin-off** | New holding created. Cost split by ratio between old and new. | Cost apportionment | P2 |
| **Merger / amalgamation** | Old replaced with new at ratio. Original buy dates carry over. | None at swap | P2 |
| **Name or ISIN change** | Label change only | None | P2 |
| **Delisting / bankruptcy** | Mark as written off | Capital loss on exit | P3 |

### 4.2 How the product handles them
- Add an **Events** section on the holding detail page. Each event has a date, type, ratio or amount, and a notes field.
- Events are recorded as their own entries and **adjust lots non-destructively**: the original lots stay and an adjustment layer applies split and bonus ratios. The user can see and reverse an event.
- **Buyback is one flow**, not two. Today it is a flag on a sale (`isBuyback` on `sales`) and also a `buyback` entry type in `misc_entries`. Merge them: a buyback is a sale event with the flag. Ask for tendered qty and accepted qty. Only accepted qty creates the sale. Remove the misc buyback path after migrating old rows.
- **Dividends** are recorded on the holding (so they appear on its detail page) and also roll into Misc income on the Gains tab. Today they are free-text misc entries with no link to a stock.
- **Suggestions**: when a stock is synced from Zerodha and the quantity jumps without a buy, show "Quantity changed by +X, was this a bonus or split?". This avoids needing a corporate-actions data feed in P1.

### 4.3 Acceptance criteria (P1)
- Buyback of 100 shares with 60 accepted creates one sale of 60, 40 shares stay, tax follows the date rule.
- A 1:5 split turns 10 shares at ₹1,000 into 50 at ₹200, keeps the buy date, and leaves total cost unchanged.
- A 1:1 bonus doubles the quantity, total cost unchanged, and the bonus lot's holding period begins on the bonus date.
- Dividend entries show per stock and in the period total.

---

## 5. KPIs

### 5.1 Definitions (one meaning each, used everywhere)

| KPI | Definition | Time basis |
|---|---|---|
| **Invested** | Cost of units currently held (FIFO remaining lots plus fees) | As of today |
| **Current value** | Qty × latest price (listed) or manual valuation. Falls back to cost if no price. | As of today |
| **Unrealised P/L** | Current value − invested, in ₹ and % | As of today |
| **Realised gain** | Gain on sales, buybacks, dividends and misc, before tax | Selected period |
| **Estimated tax** | Tax per rules incl. 4% cess, after loss set-off | Selected period |
| **Post-tax gain** | Realised gain − tax | Selected period |
| **Mix %** | Category or platform value ÷ total value | As of today |
| **XIRR** | Annualised return on all cash flows. Labelled "Annualised return" with a one-line help tip, because the case studies flag "XIRR" as confusing for beginners. | Holding or portfolio (P2) |

Rule: **each card states its time basis in its label**. The "As of today" cards never change with the period filter, and the period cards say which period. This fixes today's mixed row.

### 5.2 Value gap
The vision says "current mix". Today we only know cost. Plan:
- P1: mix by **invested cost**, labelled as such.
- P2: add prices. Stocks, ETFs and crypto from a free price feed, MFs from AMFI NAV (public, daily), gold from a daily rate. Real estate and others use manual valuation with an "as of" date.
- Once prices exist, the mix defaults to value and offers a "by cost" toggle.

### 5.3 Number precision: calculate, show, accept

Four separate rules (A to D). Mixing them is what causes totals that are off by a rupee.

**A. Calculation (full precision, round once)**
- All maths runs on unrounded numbers: average cost, FIFO cost per lot, percentages, tax. Never feed a displayed (rounded) value back into a calculation.
- **Round to 2 decimals (paise) once per result row**: each sale's proceeds, cost, gain, tax and net. That is what `round2` in `gains.ts` does today and it stays.
- **Totals are the sum of the already-rounded rows**, so a total on screen always equals the sum of the rows beneath it.
- Percentages are computed from unrounded values and rounded only for display.
- Quantity left in a lot below 0.000000001 counts as zero (existing tolerance, still valid with 8-decimal quantities).
- Tax is an estimate. We do not apply the statutory round-off to ₹10 on income or tax; say so in the tax rules note.

**B. Storage**

| Field | Today | Proposed | Why |
|---|---|---|---|
| Quantity | 4 decimals | **8 decimals** | Crypto needs 8. MF units need 3 to 4. |
| Unit price | 4 decimals | **8 decimals** | Low-priced coins (₹0.0008). Others need at most 4. |
| Fees, amounts, misc, brokerage | 4 decimals | keep 4 (inputs limited to 2) | Harmless headroom |
| Slab and tax rates | 4 decimals as a fraction | keep (equals 2 decimals as a percent) | 31.2% fits |

The quantity display today shows up to 6 decimals but storage keeps 4, so a typed 0.00001234 is silently cut. Raising storage to 8 and limiting inputs per category (C) removes that mismatch.

**C. Display**

| What | Decimals | Format | Example |
|---|---|---|---|
| Headline KPIs: Mix total, invested, realised gain, tax, post-tax | **0** | ₹, Indian grouping | ₹12,34,567 |
| Same, when the card is too narrow (phone trio) | 1, compact | L (lakh), Cr (crore), full value on tap | ₹12.3L, ₹1.2Cr |
| Per-holding invested or value on a card | **0** | ₹ | ₹45,210 |
| Row amounts in tables: sale proceeds, cost, gain, tax, net, transaction amount, fees | **2** | ₹ | ₹45,210.50 |
| Unit price and average cost | **2 minimum, up to 4**, trailing zeros past 2 dropped | ₹ | ₹182.50, ₹92.9415 (MF NAV) |
| Crypto unit price below ₹1 | up to 8, trailing zeros dropped | ₹ | ₹0.00084 |
| Quantity | stocks, ETFs, bonds: whole number. Mutual funds: up to 4 decimals. Others: up to the category limit. Trailing zeros dropped. | plain | 120 shares, 45.321 units |
| Percentages: share, P/L %, mix, annualised return | **1** | % | 12.4% |
| Tax rates and slab | up to 2, trailing zeros dropped | % | 12.5%, 30% |
| Negative amounts | same decimals | true minus sign, red | −₹1,250 |
| Zero | same decimals | muted | ₹0 |
| CSV export | money **2**, quantity up to 8 | plain number, no ₹, no commas | 45210.50 |

Rule of thumb: **totals and headlines are whole rupees, anything the user could check against a contract note or statement is shown to the paisa.** Tapping or hovering a headline shows its exact 2-decimal value.

**D. Input limits (what the user may type)**

| Field | Max decimals | Notes |
|---|---|---|
| Quantity: Stocks & ETFs, Bonds | 0 (whole units, always) | Applies to manual entry, import and sync. A fractional quantity from a file or broker is flagged as an error, not stored. Demerger or bonus fractions are settled in cash by the company, so they never leave a fractional share. |
| Quantity: Mutual Fund units | 4 | |
| Quantity: Metals (grams) | 3 | |
| Quantity: Crypto | 8 | |
| Quantity: FD, real estate, others | 4 | Use 1 for a lump sum, as today |
| Price per unit | 4 (crypto 8) | |
| Fees, brokerage, charges | 2 | |
| Amounts: dividend, misc P/L, FD principal, property cost | 2 | |
| Interest rate, coupon, slab rate, ownership share | 2 | 7.25, 31.2 |
| Weight in grams (metals) | 3 | |

Behaviour:
- A value with more decimals than allowed is **rejected with a message** ("Up to 2 decimals"), never silently rounded. The field uses `step` to match.
- Paste is cleaned: ₹, spaces and commas are stripped, so "₹1,25,000.50" is accepted.
- Zero and negative rules stay as today: quantity must be above zero, price and fees can be zero, only misc P/L may be negative.
- Existing limits stay: money up to 1e12, quantity up to 1e10.
- Bulk import flags any quantity that breaks the category limit (for example a fractional share, or a fund unit with more than 4 decimals) instead of dropping digits. Price keeps up to 8 decimals.

---

## 6. Navigation and tabs

### 6.0 What we show, by tab (decided from the vision)

Test for every item: does it help the user see their **mix, realised gain, tax or post-tax profit**, or keep that data correct? If not, it is dropped or moved one tap deeper.

| Tab | Show up front | One tap deeper | Dropped |
|---|---|---|---|
| **Dashboard** | Mix (platform, category, exposure), realised gain, tax, post-tax gain for the period, post-tax gain by FY | Top holdings, upcoming maturities | Market data, news, gainers/losers, 1D change |
| **Holdings** | Name, category, platform, invested, share of portfolio, qty, avg cost | Lots, sales, events, sector, notes, tax-turning-long-term dates | Price charts, watchlist, buy buttons |
| **Gains** | Gross gain, tax, post-tax, short vs long term, by category | Per-sale rows, misc entries (dividends, F&O), CSV export | Anything about future or unrealised outcomes |
| **Activity** | Date, type, asset, amount | Qty, price, fees, platform, notes, edit | Order status, pending orders |
| **Holding detail** | Invested, qty, avg cost, realised gain and tax for this holding | Lot-level FIFO, corporate-action events, category fields | Fundamentals, ratings, analyst views |
| **Profile** | Tax settings (slab), connected platforms, data export | Preferences, about | Account upgrades, referrals |

How each is shown follows the Groww patterns in section 9.3: one big number per card with a small delta, segmented tabs inside a screen, an eye icon to hide amounts, the same detail layout for every category, and plain wording.

### 6.1 Navigation

| | Desktop sidebar | Mobile bottom bar |
|---|---|---|
| 1 | Dashboard | **Home** |
| 2 | Holdings | **Holdings** |
| 3 | Transactions | **Activity** (Transactions) |
| 4 | Gains (Realised + Misc) | **Gains** |
| 5 | n/a | **+** Add (opens a bottom sheet: Add investment, Add sale, Add misc/dividend, Import, Sync) |

Changes from today:
- **Misc P/L stops being a tab.** It becomes a segment inside Gains ("Sales | Misc"). It is rare, and Gains already shows its totals.
- **Transactions becomes a primary mobile tab** (named Activity) because it is used far more than Misc.
- **An Add button** replaces scattered "Add" buttons. On desktop it stays a header button.
- **Holding detail has no tab.** It opens from any row or card.
- **Profile** moves to the avatar menu (6.7). Settings is no longer a sidebar item on mobile.

### 6.2 Dashboard (mobile name: Home)

Goal: answer the four vision questions in five seconds: **what is my mix, what did I realise, what tax, what do I keep.** Anything else is secondary. Order is the same on mobile and desktop. Only the grid changes.

Groww is used here only for presentation: one big number per card, a small coloured delta under it, an eye icon to hide amounts, and tabs to switch the view. The content is ours.

1. **Period bar** (top, sticky): FY selector (default current FY) and one Filters chip for category and platform. It sets the period for blocks 3 and 4. An **eye icon** hides all amounts and persists.
2. **Mix card** (first, because "current mix" is the first thing in the vision): total invested as the large number, then a donut with a switch `Platform | Category | Exposure`. Legend rows show % and ₹. Platform is the default, since the vision names it. Tap a slice to open Holdings pre-filtered. The card says "by cost" until prices exist (see 5.2).
3. **Realised trio** for the selected period, three equal cards: **Realised gain**, **Estimated tax**, **Post-tax gain**. Each states the period in its hint, for example "FY 2025-26". Post-tax gain gets the strongest colour, since it is the answer the user wants.
4. **Post-tax gain by FY**: bar chart, green profit, red loss.
5. **Top holdings**: 5 rows (name, invested, share %). "View all" goes to Holdings.
6. **Upcoming** (P2): FD and bond maturities in the next 90 days. Hidden when empty.

Unrealised P/L and annualised return (P2) sit as a small line under the Mix total, not as a hero. They support the vision but are not part of it.

| | Desktop (≥1024px) | Mobile (<1024px) |
|---|---|---|
| Mix card | Left, 1/3 width, donut and legend | Full width, top |
| Realised trio | 3 cards in a row, right 2/3 | 3 compact cards in one row; labels shorten to Gain, Tax, Post-tax |
| Chart and top holdings | 2 columns | 1 column |
| Filters | Inline | Bottom sheet from one "Filters" chip (exists today in `FilterBar`) |

Not on the dashboard: tables, per-holding detail, misc entries.

### 6.3 Holdings tab

**Row (mobile card / desktop card or table row) shows five facts:**

| Slot | Content | Size |
|---|---|---|
| Title | Name (truncate) | 16px semibold |
| Subtitle | Category · platform badge(s) | 12px muted |
| Primary number (right) | **Current value** (cost until prices exist) | 18px semibold |
| Secondary (under it) | **P/L ₹ and %** coloured green/red (once prices exist) | 13px |
| Footer stats (3) | Qty · Avg cost · % of portfolio | 12px label, 14px value |

Dropped from the card: "Since" date, fees, tax detail, lot breakdown. These live on the detail page.

**Actions on the card:** whole card opens the detail. A small **Record sale** shortcut stays, because recording a sale is how realised gain gets into the app.

**Summary strip above the list:** Total value, Total P/L, count. Platform split moves to a chip row or the dashboard mix.

**Filters** (one "Filters" button on mobile, inline chips on desktop; multi-select; saved in the URL):
- Category
- Platform
- Sector (stocks only)
- Exposure
- Result: In profit / In loss (once prices exist)
- Tag

**Value display toggle**: "Current | Invested" switches the primary number on every row, as Groww's sort bar does ("Current (Invested)").

**Sort** (single select): Value high to low (default), Value low to high, P/L % high to low, P/L ₹ high to low, Name A to Z, Quantity, Recently bought.

**Group by** (optional toggle): None, Category, Platform. Group headers show subtotal and %.

**Edit mode** with select-all and bulk delete stays as built.

**Desktop table view** (toggle with cards): adds columns Qty, Avg cost, Price (P2), Value, P/L (P2), Share %. Mobile never shows a table, because horizontal scroll fails on phones.

### 6.4 Gains tab (merges Realised gains and Misc P/L)

Segments: **Summary | Sales | Misc**.

- **Header cards**: Gross gain, Estimated tax, Post-tax gain for the period.
- **Summary**: by category (cards), by FY (chart), short-term vs long-term split.
- **Sales**: today's realised table. Mobile columns: date, asset, net. The rest on tap.
- **Misc** (how to show it): list of entries as compact rows: date, type chip (Dividend, F&O, Interest, Other, Buyback), amount, net after tax. Group by type with subtotal at the top (e.g. "Dividends ₹12,400 · F&O −₹3,200"). Add via the **+** sheet. Dividends tied to a stock show its name and link to it.
- **Export CSV** stays. Export follows the filters (already done).
- Filters: Category, Platform, Term, Result (as today).

### 6.5 Transactions tab (mobile: Activity)

- One chronological feed grouped by month. Month header shows count and net cash flow.
- Row: type chip (Buy / Sell / Buyback / Dividend / Misc), asset name, qty × price, amount. Date on the left. Mobile shows date, chip, name, amount; qty, price, fees and platform on tap.
- Filters: Period, Action, Category, Platform, plus search.
- Tap a row to open its edit page. Corporate-action events appear in this feed with their own chip.
- Desktop keeps the sortable table.

### 6.6 Holding detail (no tab; reached by tapping a holding)

Top to bottom:
1. **Header**: name, category and platform badges, More (edit, delete, add event). **Record sale** is a normal header button on desktop and mobile. We do not use a sticky bottom bar: it is a trading call-to-action, and recording a sale is an occasional task for us.
2. **KPI row (4)**: Current value, Invested, Unrealised P/L, Realised gain (with tax in hint).
3. **Tabs inside the page** (segmented control): **Overview | Lots | Sales | Events | Info**.
   - Overview: a **value-versus-invested chart** over time (P3; range chips 1Y, 3Y, ALL), avg cost, qty, annualised return (P2), holding period split (short-term vs long-term lots, so the user sees when lots turn long-term).
   - Lots: purchases table with sold and remaining. Edit and delete (as today).
   - Sales: sales with gain, tax, net (as today).
   - Events: corporate actions and dividends (new).
   - Info: category-specific fields from section 3 (sector, folio, FD maturity, property details) and notes.
4. Category-specific extras: FD shows maturity countdown and accrued interest. Bonds show next coupon. SGB shows maturity and RBI interest.

### 6.7 Profile (avatar menu)

Tapping the avatar opens a menu (desktop popover, mobile bottom sheet):

| Item | Contents |
|---|---|
| Header | Photo, name, email |
| **Profile** | Name, photo (from Google), email (read-only) |
| **Tax settings** | Slab rate, tax regime, financial-year start (fixed April), "Tax rules applied" table (moved from Settings) |
| **Connected platforms** | Zerodha Kite connect, last sync, add platform (Groww import) |
| **Platforms and tags** | Manage the platform list and tags |
| **Preferences** | Theme, default period, mix by value or cost, number format |
| **Data** | Export all data (CSV), import trades, delete account |
| **About** | Version, creator, tax disclaimer, privacy, contact/feedback |
| Sign out | |

Settings stops being a bottom-bar item and a sidebar page. The same content is reachable as sub-pages under the avatar menu.

### 6.8 Visual standards: colour and type

**Colour: unchanged.** The current theme stays exactly as defined in `globals.css`: deep green primary, cool-grey surfaces, restrained gold accent, light and dark modes. Rules we add on top:
- Gain uses `--gain`, loss uses `--loss`. Never rely on colour alone: show a sign (+/−) too.
- Gold (`--accent`) is for warnings and the Record-sale chips only.
- Verify muted text at 12px meets 4.5:1 contrast in both modes.

**Type: one scale of nine roles on a short size ladder (12, 13, 14, 16, 18, 20, 24, 26, 28), one font (Inter, as today).** Today the code mixes `text-xs/sm/base/lg/xl/2xl` with ad-hoc `11px`, `13px`, `15px`, `17px` and `26px`. Replace them with these roles.

| Role | Mobile | Desktop | Weight | Line height | Used for |
|---|---|---|---|---|---|
| **Hero** | 26 | 28 | 600 | 1.1 | Mix total on the dashboard. Once per screen. |
| **Page title** | 20 | 24 | 600 | 1.25 | Screen heading |
| **KPI value** | 18 | 24 | 600 | 1.2 | Realised trio, detail-page KPIs |
| **Value** | 18 | 18 | 600 | 1.3 | Primary number on a holding card or row |
| **Title** | 16 | 16 | 600 | 1.35 | Section title, holding name, bottom-sheet heading |
| **Body** | 14 | 14 | 400 | 1.45 | Table cells, descriptions, buttons (500) |
| **Body strong** | 14 | 14 | 600 | 1.45 | Footer stat values, emphasised cells |
| **Label** | 13 | 13 | 500 | 1.4 | KPI labels, form labels (muted) |
| **Caption** | 12 | 12 | 500 | 1.35 | Badges, hints, table headers, chips, bottom-tab labels, dates, sub-lines |

Rules:
- **Floor is 12px.** The 11px bottom-tab labels and sidebar section titles move to 12px.
- **Three weights only:** 400, 500, 600. No bold 700.
- **Numbers** are always tabular (`.num`), right-aligned in tables, and never wrap. Currency symbol is the same size as the number.
- **Trio cards on a 360px phone** use KPI value at 18px and Caption labels so ₹12,34,567 fits on one line. If it still does not fit, abbreviate (₹12.3L) and show the full value on tap.
- **Inputs stay 14px** on all screens, as today. Known trade-off: iOS Safari zooms the page when a 14px field is focused. Accepted; we do not disable pinch-zoom to hide it.
- **Uppercase** only for the small sidebar section titles (12px, +0.04em tracking). Nowhere else.
- **Hierarchy per card:** at most one Hero/KPI/Value number, one Label or Title, and Caption lines. If a card needs a fourth size, remove content instead.
- **User text scaling:** sizes are in rem so browser font settings still work. Layouts must not break at 130% text.

Implementation note: define these as named utilities in `globals.css` (`t-hero`, `t-page`, `t-kpi`, `t-value`, `t-title`, `t-body`, `t-label`, `t-caption`), the same way `kpi-label` and `badge` are defined now. Then replace the ~130 ad-hoc `text-*` classes screen by screen as each is redesigned, not in one sweep.

---

## 7. Roadmap

| Phase | Scope | Why this order |
|---|---|---|
| **P1: Foundations** (about 3 to 4 weeks) | New categories and exposure mapping. Platform stored on each asset. Capture fields from section 3 (the required ones). Merge buyback into one flow. Split, bonus, dividend events. Navigation change (Misc into Gains, Activity tab, Add sheet). Dashboard restructure on cost. Holdings card update. Avatar menu. Number precision (quantity and price storage to 8 decimals, input limits per category) and the type-scale utilities. | No new data source needed. Fixes the model and the structure. |
| **P2: Value** | Prices (stocks/ETF, AMFI NAV, gold, crypto) and manual valuation. Unrealised P/L, value mix, sector filter. FD/bond fields and maturity reminders. Rights, demerger, merger. | Needs a price-feed decision (Q4). |
| **P3: Insight** | Value-over-time charts, tax-harvesting hints, family accounts, Groww/other broker sync. | Nice to have. |

---

## 8. Open questions (need your decision)

| # | Question | My recommendation |
|---|---|---|
| Q1 | Should the mix be by cost (works now) or by value (needs prices)? | Ship by cost in P1 and label it. Add value in P2. |
| Q2 | SGB under Metals or Bonds? | Metals, because users think of it as gold. Tax is handled by its sub-type either way. |
| Q3 | Merge Misc into Gains, or keep it a separate tab? | Merge. It is rare, and the totals already live in Gains. |
| Q4 | Which price source? | AMFI for MF NAV (free, official). For stocks, check the Kite API (you already connect) before paying for a feed. |
| Q5 | Is multi-user family tracking (one login, several people's accounts) in scope? | Out of scope for now. The "account nickname" field keeps the door open. |
| Q6 | Track brokerage-account cash balances? | No. Not part of the vision. |

---

## 9. Groww findings and what we take from them

Sources: Behance "Groww _product breakdown" (Nigel Dias, Jan 2026, mobile app, dark mode) and Medium "Enhancing User Experience for a Trading Platform Groww" (Hannypathak, Jul 2023, home screen). Both are outside reviews.

### 9.1 What Groww does

| Area | Groww pattern |
|---|---|
| Bottom bar | 5 product tabs: Stocks, F&O, Mutual Funds, UPI, Loans. Organised by **product**. |
| Inside a product | Top segmented tabs. Stocks: Explore, Holdings, Positions, Orders, Watchlist. Mutual Funds: Explore, Dashboard, SIPs, Watchlist. |
| Header | Section title on the left. Search, QR and **profile avatar on the top right**. |
| Investments card (MF dashboard) | Invested, current value, **1D returns, total returns, XIRR**, an eye icon to hide amounts, and a sort bar with a "Current (Invested)" switch |
| Orders | Collapsible "Orders (1)" block above Investments, with an "All orders" link |
| Detail page | Name, risk tags, annualised return, chart with range chips (1M, 6M, 1Y, 3Y, 5Y, ALL), key facts (NAV, rating, min SIP, fund size). **Sticky bottom buttons.** Top-right icons for cart, watchlist and search. |
| Consistency | MF, stock and gold detail pages share one layout, with the chart, key stats and buy buttons in the same places |
| Home (2023) | Search with a hint ("Search ITC"), index cards, shortcut chips, most bought, gainers/losers, news |
| Help | In-app chat, call, email and FAQs |
| Tone | White, green and blue. Plain words. Progressive disclosure: details only when needed. |

### 9.2 Problems the reviewers found
- Terms like **F&O and XIRR** confuse beginners.
- A 5-tab bar with trading jargon can feel crowded.
- Search results mix stocks, funds and IPOs without consistent labels or icons.
- Nav buttons without icons were hard to recognise. The fix was icons plus search hint text.
- Error recovery (for example payment failure) lacks helpful messages.

### 9.3 What we adopt

| Groww pattern | Our decision | Where |
|---|---|---|
| Profile avatar top right | Same. Avatar menu holds profile, tax settings, platforms, data, about. | 6.7 |
| Top segmented tabs inside a section | Use for Gains (Summary / Sales / Misc) and holding detail (Overview / Lots / Sales / Events / Info). | 6.4, 6.6 |
| Big number plus small delta per card | Used for the Mix total and the realised trio. Unrealised P/L and annualised return (P2) are small lines. **1D change is skipped.** | 5.1, 6.2 |
| Eye icon to hide amounts | Add to the dashboard period bar, persistent. | 6.2 |
| "Current / Invested" switch | Add to Holdings. | 6.3 |
| Sticky bottom buy/SIP buttons | **Not adopted.** Trading call-to-action. | 6.6 |
| Price chart with range chips | **Demoted.** Our chart is value versus invested, in P3. | 6.6 |
| Same detail layout for every asset class | Keep one layout. Only the Info tab and KPI labels change by category. | 6.6 |
| Icon plus label on every nav item | Already true. Keep it as a rule. | 6.1 |
| Search with a hint | Holdings and Activity search placeholders name the fields searched ("Search name, platform or tag"). Already close in the code. | 6.3, 6.5 |
| Plain language | Say "Annualised return", not XIRR. Say "Gain" and "Tax", not capital-gains jargon. Tax-term help tips. | 5.1 |

### 9.4 Where we deliberately differ
- **Groww exists to make investments, so its screens are built around buying, watching prices and placing orders. Ours exist to track what you hold and what you realised. Every requirement here is judged by that.** Groww is a reference for layout and clarity only.
- **We are a tracker, not a broker.** No Explore, Orders, Positions, Watchlist, UPI or Loans, and no Buy/Sell execution. Our "Record sale" logs a sale that already happened elsewhere. We also skip market data for discovery: gainers/losers, most bought, news, index cards.
- **Navigation follows the job, not the product.** Groww splits stocks and funds into separate tabs. We show everything in one portfolio, with category and platform as filters. Our bottom bar is Home, Holdings, Activity, Gains, plus Add.
- **We add what Groww does not show:** the mix across platforms, realised gain, estimated tax and post-tax profit for a chosen period. That is our reason to exist.

### 9.5 Still to check on Groww web and the live app
Neither case study covers these, so look at them before design sign-off:
- Holdings row columns on mobile and web **(verify)**. The Behance screenshots blur the values.
- Holdings sort and filter controls **(verify)**.
- The Groww "Portfolios" feature under Holdings (three-dot menu), which lets users group stocks their own way. This supports our tag and group-by design.
- Stocks Track, which groups external holdings by broker and supports our platform dimension.
- The profile page layout.

---

## 10. Out of scope
Trading or order placement, advice or recommendations, tax filing, surcharge and carry-forward of losses (as today), live brokerage balances.
