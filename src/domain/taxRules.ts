// Single source of truth for Indian capital-gains rules. Re-verify each Union Budget.
// Surcharge is ignored; 4% health & education cess is applied on tax.

export type Term = "STCG" | "LTCG";

export type Rate =
  | { kind: "flat"; rate: number }
  | { kind: "slab" }
  | { kind: "exempt" };

export type AssetTypeId =
  | "equity"
  | "equity_mf"
  | "debt_mf"
  | "bond_listed"
  | "bond_unlisted"
  | "fd"
  | "rd"
  | "ppf_epf"
  | "land"
  | "gold_physical"
  | "gold_etf"
  | "sgb"
  | "crypto"
  | "other";

/** How the user thinks of an investment: where and how they manage it. Tax treatment is the sub-type. */
export type Category =
  | "Stocks & ETFs"
  | "Mutual Funds"
  | "Fixed Deposits"
  | "Bonds"
  | "Metals"
  | "Real Estate"
  | "Crypto"
  | "Govt schemes"
  | "Other";

/** What the money is really exposed to, derived from category and sub-type. */
export type Exposure = "Equity" | "Debt" | "Gold" | "Real estate" | "Crypto" | "Other";

export const CATEGORIES: Category[] = [
  "Stocks & ETFs",
  "Mutual Funds",
  "Fixed Deposits",
  "Bonds",
  "Metals",
  "Real Estate",
  "Crypto",
  "Govt schemes",
  "Other",
];

export interface AssetRule {
  label: string;
  category: Category;
  exposure: Exposure;
  /** Short tax sub-type shown under the category, e.g. "Equity MF" or "SGB". */
  subType: string;
  /** Held for MORE than this many months => long term. null => no long-term concept (always STCG). */
  longTermMonths: number | null;
  stcg: Rate;
  ltcg: Rate;
  /** LTCG gains share the yearly equity exemption pool. */
  usesEquityExemption?: boolean;
  /** Losses cannot be set off / do not count (crypto). */
  noLossSetOff?: boolean;
  /** Short hint shown in the UI. */
  note: string;
}

export const CESS = 0.04;
export const DEFAULT_SLAB_RATE = 0.3;

export const EQUITY_REGIME_CHANGE_DATE = "2024-07-23";

// Buyback proceeds are taxed as deemed dividend in the shareholder's hands from this date;
// before it the company paid the tax and the shareholder received the proceeds tax-free.
export const BUYBACK_DIVIDEND_FROM = "2024-10-01";

// Equity rates by sale date: [effective-from, stcg, ltcg, annual LTCG exemption]
export const EQUITY_RATES = [
  { from: "0000-01-01", stcg: 0.15, ltcg: 0.1, exemption: 100000 },
  { from: EQUITY_REGIME_CHANGE_DATE, stcg: 0.2, ltcg: 0.125, exemption: 125000 },
] as const;

/** The yearly LTCG exemption is one amount per financial year: the one in force at the end of that year. */
export function equityExemptionFor(date: string): number {
  const [y, m] = date.split("-").map(Number);
  return equityRatesFor(`${m >= 4 ? y + 1 : y}-03-31`).exemption;
}

export function equityRatesFor(date: string) {
  let current: (typeof EQUITY_RATES)[number] = EQUITY_RATES[0];
  for (const r of EQUITY_RATES) if (date >= r.from) current = r;
  return current;
}

const LTCG_125: Rate = { kind: "flat", rate: 0.125 };
const SLAB: Rate = { kind: "slab" };

export const ASSET_RULES: Record<AssetTypeId, AssetRule> = {
  equity: {
    label: "Stocks / Equity ETF",
    category: "Stocks & ETFs",
    exposure: "Equity",
    subType: "Equity",
    longTermMonths: 12,
    stcg: { kind: "flat", rate: 0.2 },
    ltcg: LTCG_125,
    usesEquityExemption: true,
    note: "Long term after 12 months. STCG 20%, LTCG 12.5% above ₹1.25L per FY.",
  },
  equity_mf: {
    label: "Equity Mutual Fund",
    category: "Mutual Funds",
    exposure: "Equity",
    subType: "Equity MF",
    longTermMonths: 12,
    stcg: { kind: "flat", rate: 0.2 },
    ltcg: LTCG_125,
    usesEquityExemption: true,
    note: "Long term after 12 months. STCG 20%, LTCG 12.5% above ₹1.25L per FY.",
  },
  debt_mf: {
    label: "Debt Mutual Fund",
    category: "Mutual Funds",
    exposure: "Debt",
    subType: "Debt MF",
    longTermMonths: null,
    stcg: SLAB,
    ltcg: SLAB,
    note: "Gains taxed at your slab rate (units bought after Apr 2023).",
  },
  bond_listed: {
    label: "Bond / Debenture (listed)",
    category: "Bonds",
    exposure: "Debt",
    subType: "Listed",
    longTermMonths: 12,
    stcg: SLAB,
    ltcg: LTCG_125,
    note: "Long term after 12 months at 12.5%; short term at slab rate.",
  },
  bond_unlisted: {
    label: "Bond / Debenture (unlisted)",
    category: "Bonds",
    exposure: "Debt",
    subType: "Unlisted",
    longTermMonths: null,
    stcg: SLAB,
    ltcg: SLAB,
    note: "Always taxed at slab rate (Sec 50AA, from 23 Jul 2024).",
  },
  fd: {
    label: "Fixed Deposit",
    category: "Fixed Deposits",
    exposure: "Debt",
    subType: "FD",
    longTermMonths: null,
    stcg: SLAB,
    ltcg: SLAB,
    note: "Interest earned is taxed at slab rate. Enter maturity amount as the sale price.",
  },
  rd: {
    label: "Recurring Deposit",
    category: "Fixed Deposits",
    exposure: "Debt",
    subType: "RD",
    longTermMonths: null,
    stcg: SLAB,
    ltcg: SLAB,
    note: "Interest earned is taxed at slab rate. Enter maturity amount as the sale price.",
  },
  ppf_epf: {
    label: "PPF / EPF",
    category: "Govt schemes",
    exposure: "Debt",
    subType: "PPF / EPF",
    longTermMonths: null,
    stcg: { kind: "exempt" },
    ltcg: { kind: "exempt" },
    note: "Treated as tax-free (within statutory limits).",
  },
  land: {
    label: "Land / Real Estate",
    category: "Real Estate",
    exposure: "Real estate",
    subType: "Land / property",
    longTermMonths: 24,
    stcg: SLAB,
    ltcg: LTCG_125,
    note: "Long term after 24 months at 12.5% without indexation. Pre-Jul-2024 indexation option is not modelled.",
  },
  gold_physical: {
    label: "Gold (physical / digital)",
    category: "Metals",
    exposure: "Gold",
    subType: "Physical / digital",
    longTermMonths: 24,
    stcg: SLAB,
    ltcg: LTCG_125,
    note: "Long term after 24 months at 12.5%; short term at slab rate.",
  },
  gold_etf: {
    label: "Commodity ETF (gold / silver)",
    category: "Stocks & ETFs",
    exposure: "Gold",
    subType: "Commodity ETF",
    longTermMonths: 12,
    stcg: SLAB,
    ltcg: LTCG_125,
    note: "Long term after 12 months at 12.5%; short term at slab rate.",
  },
  sgb: {
    label: "Sovereign Gold Bond",
    category: "Metals",
    exposure: "Gold",
    subType: "Sovereign Gold Bond",
    longTermMonths: 12,
    stcg: SLAB,
    ltcg: LTCG_125,
    note: "Tick 'redeemed with RBI' on sale for the tax-free maturity redemption.",
  },
  crypto: {
    label: "Crypto / VDA",
    category: "Crypto",
    exposure: "Crypto",
    subType: "VDA",
    longTermMonths: null,
    stcg: { kind: "flat", rate: 0.3 },
    ltcg: { kind: "flat", rate: 0.3 },
    noLossSetOff: true,
    note: "Flat 30% on gains; losses cannot be set off.",
  },
  other: {
    label: "Other",
    category: "Other",
    exposure: "Other",
    subType: "Generic",
    longTermMonths: 24,
    stcg: SLAB,
    ltcg: LTCG_125,
    note: "Generic: slab rate short term, 12.5% long term.",
  },
};

export const ASSET_TYPE_IDS = Object.keys(ASSET_RULES) as AssetTypeId[];

export function isAssetType(v: string): v is AssetTypeId {
  return v in ASSET_RULES;
}
