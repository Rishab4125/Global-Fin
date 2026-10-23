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

export interface AssetRule {
  label: string;
  group: string;
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

// Equity rates by sale date: [effective-from, stcg, ltcg, annual LTCG exemption]
export const EQUITY_RATES = [
  { from: "0000-01-01", stcg: 0.15, ltcg: 0.1, exemption: 100000 },
  { from: EQUITY_REGIME_CHANGE_DATE, stcg: 0.2, ltcg: 0.125, exemption: 125000 },
] as const;

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
    group: "Equity",
    longTermMonths: 12,
    stcg: { kind: "flat", rate: 0.2 },
    ltcg: LTCG_125,
    usesEquityExemption: true,
    note: "Long term after 12 months. STCG 20%, LTCG 12.5% above ₹1.25L per FY.",
  },
  equity_mf: {
    label: "Equity Mutual Fund",
    group: "Equity",
    longTermMonths: 12,
    stcg: { kind: "flat", rate: 0.2 },
    ltcg: LTCG_125,
    usesEquityExemption: true,
    note: "Long term after 12 months. STCG 20%, LTCG 12.5% above ₹1.25L per FY.",
  },
  debt_mf: {
    label: "Debt Mutual Fund",
    group: "Debt",
    longTermMonths: null,
    stcg: SLAB,
    ltcg: SLAB,
    note: "Gains taxed at your slab rate (units bought after Apr 2023).",
  },
  bond_listed: {
    label: "Bond / Debenture (listed)",
    group: "Debt",
    longTermMonths: 12,
    stcg: SLAB,
    ltcg: LTCG_125,
    note: "Long term after 12 months at 12.5%; short term at slab rate.",
  },
  bond_unlisted: {
    label: "Bond / Debenture (unlisted)",
    group: "Debt",
    longTermMonths: null,
    stcg: SLAB,
    ltcg: SLAB,
    note: "Always taxed at slab rate (Sec 50AA, from 23 Jul 2024).",
  },
  fd: {
    label: "Fixed Deposit",
    group: "Fixed income",
    longTermMonths: null,
    stcg: SLAB,
    ltcg: SLAB,
    note: "Interest earned is taxed at slab rate. Enter maturity amount as the sale price.",
  },
  rd: {
    label: "Recurring Deposit",
    group: "Fixed income",
    longTermMonths: null,
    stcg: SLAB,
    ltcg: SLAB,
    note: "Interest earned is taxed at slab rate. Enter maturity amount as the sale price.",
  },
  ppf_epf: {
    label: "PPF / EPF",
    group: "Fixed income",
    longTermMonths: null,
    stcg: { kind: "exempt" },
    ltcg: { kind: "exempt" },
    note: "Treated as tax-free (within statutory limits).",
  },
  land: {
    label: "Land / Real Estate",
    group: "Real estate",
    longTermMonths: 24,
    stcg: SLAB,
    ltcg: LTCG_125,
    note: "Long term after 24 months at 12.5% without indexation. Pre-Jul-2024 indexation option is not modelled.",
  },
  gold_physical: {
    label: "Gold (physical / digital)",
    group: "Gold",
    longTermMonths: 24,
    stcg: SLAB,
    ltcg: LTCG_125,
    note: "Long term after 24 months at 12.5%; short term at slab rate.",
  },
  gold_etf: {
    label: "Gold ETF / Gold Fund",
    group: "Gold",
    longTermMonths: 12,
    stcg: SLAB,
    ltcg: LTCG_125,
    note: "Long term after 12 months at 12.5%; short term at slab rate.",
  },
  sgb: {
    label: "Sovereign Gold Bond",
    group: "Gold",
    longTermMonths: 12,
    stcg: SLAB,
    ltcg: LTCG_125,
    note: "Tick 'redeemed with RBI' on sale for the tax-free maturity redemption.",
  },
  crypto: {
    label: "Crypto / VDA",
    group: "Crypto",
    longTermMonths: null,
    stcg: { kind: "flat", rate: 0.3 },
    ltcg: { kind: "flat", rate: 0.3 },
    noLossSetOff: true,
    note: "Flat 30% on gains; losses cannot be set off.",
  },
  other: {
    label: "Other",
    group: "Other",
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
