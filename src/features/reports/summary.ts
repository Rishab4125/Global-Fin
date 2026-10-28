import type { RealisedRow } from "../../domain/gains";
import { ASSET_RULES } from "../../domain/taxRules";
import { csvMoney, csvQty } from "../../lib/format";

export interface Totals {
  gain: number;
  tax: number;
  net: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export function totals(rows: RealisedRow[]): Totals {
  const gain = rows.reduce((s, r) => s + r.gain, 0);
  const tax = rows.reduce((s, r) => s + r.tax, 0);
  return { gain: r2(gain), tax: r2(tax), net: r2(gain - tax) };
}

export function byFinancialYear(rows: RealisedRow[]) {
  const map = new Map<string, RealisedRow[]>();
  for (const r of rows) map.set(r.fy, [...(map.get(r.fy) ?? []), r]);
  return [...map.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([fy, rs]) => ({ fy, ...totals(rs) }));
}

export function byAssetGroup(rows: RealisedRow[]) {
  const map = new Map<string, RealisedRow[]>();
  for (const r of rows) {
    const g = ASSET_RULES[r.assetType].category;
    map.set(g, [...(map.get(g) ?? []), r]);
  }
  return [...map.entries()].map(([group, rs]) => ({ group, ...totals(rs) }));
}

/**
 * One CSV cell. Text that starts with = + - @ would run as a formula when the file is opened in Excel, so it is made
 * literal. Numbers written by csvMoney/csvQty are strings too, so a plain negative number is left alone.
 */
export function csvCell(v: string | number | null): string {
  let s = v === null ? "" : String(v);
  const plainNumber = /^-?\d+(\.\d+)?$/.test(s);
  if (typeof v === "string" && !plainNumber && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: RealisedRow[]): string {
  const esc = csvCell;
  const header = [
    "Date",
    "Financial year",
    "Type",
    "Asset class",
    "Name",
    "Quantity",
    "Proceeds",
    "Cost",
    "Short-term gain",
    "Long-term gain",
    "Total gain",
    "Tax applied",
    "Tax",
    "Net gain",
    "Note",
  ];
  const lines = rows.map((r) =>
    [
      r.date,
      r.fy,
      r.kind === "sale" ? "Sale" : "Misc",
      ASSET_RULES[r.assetType].label,
      r.label,
      r.qty === null ? null : csvQty(r.qty),
      r.proceeds === null ? null : csvMoney(r.proceeds),
      r.cost === null ? null : csvMoney(r.cost),
      csvMoney(r.stcg),
      csvMoney(r.ltcg),
      csvMoney(r.gain),
      r.taxApplied ? "Yes" : "No",
      csvMoney(r.tax),
      csvMoney(r.netGain),
      r.note,
    ]
      .map(esc)
      .join(","),
  );
  return [header.join(","), ...lines].join("\n");
}

export interface TermSplit {
  short: number;
  long: number;
  /** Dividend income, which is neither short- nor long-term. */
  income: number;
  /** What is left of the gain after the three above; non-zero only when a buyback's dividend part is in the gain. */
  other: number;
  total: number;
}

/** How the gain divides into short term, long term and dividend income. The parts always add up to the total. */
export function termSplit(rows: RealisedRow[]): TermSplit {
  const sum = (f: (r: RealisedRow) => number) => r2(rows.reduce((s, r) => s + f(r), 0));
  const short = sum((r) => r.stcg);
  const long = sum((r) => r.ltcg);
  const income = sum((r) => r.income);
  const total = sum((r) => r.gain);
  return { short, long, income, other: r2(total - short - long - income), total };
}

export interface MiscGroup {
  label: string;
  count: number;
  gain: number;
  net: number;
  rows: RealisedRow[];
}

/** Misc entries grouped by type, Dividends first, then the largest groups. Each group has its subtotal. */
export function groupMisc(rows: RealisedRow[], typeOf: (r: RealisedRow) => string): MiscGroup[] {
  const map = new Map<string, RealisedRow[]>();
  for (const r of rows) {
    const k = typeOf(r);
    map.set(k, [...(map.get(k) ?? []), r]);
  }
  return [...map.entries()]
    .map(([label, rs]) => {
      const t = totals(rs);
      return { label, count: rs.length, gain: t.gain, net: t.net, rows: rs };
    })
    .sort((a, b) => {
      if (a.label === "Dividends") return -1;
      if (b.label === "Dividends") return 1;
      return Math.abs(b.gain) - Math.abs(a.gain) || (a.label < b.label ? -1 : 1);
    });
}
