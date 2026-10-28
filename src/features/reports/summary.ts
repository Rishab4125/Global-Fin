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

export function toCsv(rows: RealisedRow[]): string {
  // Text that starts with = + - @ would run as a formula when the file is opened in Excel, so it is made literal.
  const esc = (v: string | number | null) => {
    let s = v === null ? "" : String(v);
    // Numbers written by csvMoney/csvQty are strings too, so a plain negative number must not be mistaken for a formula.
    const plainNumber = /^-?\d+(\.\d+)?$/.test(s);
    if (typeof v === "string" && !plainNumber && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
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
