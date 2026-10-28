// Display rules for numbers (PRD 5.3 C). Everything shown on screen or exported goes through here.
// Totals and headlines are whole rupees; anything the user could check against a contract note is shown to the paisa.
import { QTY_DECIMALS } from "../domain/limits";
import { ASSET_RULES, type AssetTypeId } from "../domain/taxRules";

/** A true minus sign, so a negative is never mistaken for a hyphen. */
export const MINUS = "−";

const grouped = (min: number, max: number) =>
  new Intl.NumberFormat("en-IN", { minimumFractionDigits: min, maximumFractionDigits: max });
const g0 = grouped(0, 0);
const g2 = grouped(2, 2);
const g2to4 = grouped(2, 4);
const g2to8 = grouped(2, 8);
const g1 = grouped(1, 1);

const round = (n: number, places: number) => {
  const f = 10 ** places;
  return Math.round((Math.abs(n) + Number.EPSILON) * f) / f;
};

/** "−" for a negative that survives rounding to `places`, "+" for a positive when asked, else nothing. */
function signOf(n: number, places: number, showPlus: boolean) {
  const shown = round(n, places);
  if (shown === 0) return "";
  return n < 0 ? MINUS : showPlus ? "+" : "";
}

interface SignOpt {
  /** Put "+" before gains, so a gain is not shown by colour alone. */
  sign?: boolean;
}

/** Headline amount: whole rupees, Indian grouping. ₹12,34,567 */
export const formatINRWhole = (n: number, o: SignOpt = {}) =>
  `${signOf(n, 0, !!o.sign)}₹${g0.format(round(n, 0))}`;

/** Amount in a table row: always two decimals. ₹45,210.50 */
export const formatINR = (n: number, o: SignOpt = {}) => `${signOf(n, 2, !!o.sign)}₹${g2.format(round(n, 2))}`;

/** Headline for a narrow card: ₹12.3L, ₹1.2Cr; under a lakh it stays whole rupees. */
export function formatINRCompact(n: number, o: SignOpt = {}): string {
  const a = Math.abs(n);
  const trim = (x: string) => x.replace(/\.0$/, "");
  if (a >= 1e5) {
    const lakh = Number((a / 1e5).toFixed(1));
    const sign = signOf(n, 0, !!o.sign);
    if (a >= 1e7 || lakh >= 100) return `${sign}₹${trim(g1.format(a / 1e7))}Cr`;
    return `${sign}₹${trim(g1.format(a / 1e5))}L`;
  }
  return formatINRWhole(n, o);
}

/**
 * Unit price or average cost: two decimals minimum, up to four, trailing zeros past two dropped.
 * A crypto price below ₹1 may use up to eight (₹0.00084).
 */
export function formatPrice(n: number, o: { crypto?: boolean } = {}): string {
  const fmt = o.crypto && Math.abs(n) < 1 ? g2to8 : g2to4;
  const places = o.crypto && Math.abs(n) < 1 ? 8 : 4;
  return `${signOf(n, places, false)}₹${fmt.format(round(n, places))}`;
}

/**
 * Quantity without trailing zeros. With a type, it follows that category's limit: whole units for stocks, ETFs
 * and bonds, up to 4 decimals for funds, 3 for metals, 8 for crypto. Without one, up to 8.
 */
export function formatQty(n: number, type?: AssetTypeId): string {
  const max = type ? QTY_DECIMALS[ASSET_RULES[type].category] : 8;
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: max }).format(n);
}

/** Share, profit/loss % or annualised return: one decimal. 12.4% */
export const formatPercent = (n: number, o: SignOpt = {}) =>
  `${signOf(n, 1, !!o.sign)}${g1.format(round(n, 1))}%`;

/** A tax or interest rate: up to two decimals, trailing zeros dropped. 12.5%, 30% */
export const formatRate = (n: number) => `${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(n)}%`;

/** Money for a CSV file: two decimals, no symbol, no commas. 45210.50 */
export const csvMoney = (n: number) => (Math.abs(n) < 0.005 ? 0 : n).toFixed(2);

/** Quantity for a CSV file: up to eight decimals, trailing zeros dropped, no commas. */
export const csvQty = (n: number) => String(Number(n.toFixed(8)));

export function formatDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export const gainClass = (n: number) => (n > 0 ? "text-gain" : n < 0 ? "text-loss" : "text-muted");
