import { ASSET_RULES, type AssetTypeId, type Category } from "./taxRules";

/** Most decimals a quantity may have, by category (PRD 5.3 D). 0 means whole units only. */
export const QTY_DECIMALS: Record<Category, number> = {
  "Stocks & ETFs": 0,
  Bonds: 0,
  "Mutual Funds": 4,
  Metals: 3,
  Crypto: 8,
  "Fixed Deposits": 4,
  "Real Estate": 4,
  "Govt schemes": 4,
  Other: 4,
};

/** Fees, brokerage, dividends, misc amounts and other money the user types. */
export const MONEY_DECIMALS = 2;
/** Interest rate, coupon, slab rate and ownership share, as a percent. */
export const RATE_DECIMALS = 2;

export const qtyDecimals = (type: AssetTypeId) => QTY_DECIMALS[ASSET_RULES[type].category];
export const priceDecimals = (type: AssetTypeId) => (type === "crypto" ? 8 : 4);

/** Number of digits after the decimal point, also for values JavaScript prints as 1e-7. */
export function placesOf(n: number): number {
  let s = String(n);
  if (/e/i.test(s)) s = n.toFixed(20).replace(/0+$/, "");
  const i = s.indexOf(".");
  return i < 0 ? 0 : s.length - i - 1;
}

export const decimalsMessage = (max: number) => (max === 0 ? "Whole units only" : `Up to ${max} decimals`);

/**
 * The message to show when a quantity or price has more decimals than its category allows, else null.
 * Used by every path that stores one: forms, imports and sync. It never rounds; the user must fix the value.
 */
export function limitError(type: AssetTypeId, v: { qty?: number; price?: number }): string | null {
  if (v.qty !== undefined && placesOf(v.qty) > qtyDecimals(type)) {
    return `Quantity: ${decimalsMessage(qtyDecimals(type)).toLowerCase()} for ${ASSET_RULES[type].category}`;
  }
  if (v.price !== undefined && placesOf(v.price) > priceDecimals(type)) {
    return `Price: ${decimalsMessage(priceDecimals(type)).toLowerCase()}`;
  }
  return null;
}
