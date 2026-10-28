import type { RealisedRow } from "@/domain/gains";
import { inPeriod, resolvePeriod } from "@/domain/period";
import { ASSET_RULES } from "@/domain/taxRules";
import { filterQs, passes, readFilters, type Filters } from "@/lib/filters";
import type { Portfolio } from "@/features/portfolio/data";

export const TERMS = ["Short term", "Long term"];
export const RESULTS = ["Profit", "Loss"];

/** The Misc type of a misc row: Dividends, or the asset type the entry was recorded under. */
export const miscTypeOf = (r: RealisedRow, dividendIds: Set<string>) =>
  dividendIds.has(r.id) ? "Dividends" : ASSET_RULES[r.assetType].label;

export type RealisedQuery = {
  period?: string;
  from?: string;
  to?: string;
  ty?: string;
  term?: string;
  sign?: string;
  pf?: string;
};

/** Asset classes present in the realised rows, for the filter's options. */
export const realisedGroups = (rows: RealisedRow[]) =>
  [...new Set(rows.map((r) => ASSET_RULES[r.assetType].category))].sort();

/** Period and list filters for the realised report; shared by the page and the CSV export so they always agree. */
export function realisedView(pf: Portfolio, query: RealisedQuery, today: string) {
  const period = resolvePeriod(query, today);
  const groups = realisedGroups(pf.rows);
  const filters: Filters = readFilters(query, ["ty", "term", "sign", "pf"], {
    ty: groups,
    term: TERMS,
    sign: RESULTS,
    pf: pf.platforms,
  });
  const salePlatforms = new Map(pf.saleEvents.map((s) => [s.id, s.platforms]));
  const rows = pf.rows.filter(
    (r) =>
      inPeriod(r.date, period) &&
      passes(filters.ty, ASSET_RULES[r.assetType].category) &&
      passes(filters.term, [Math.abs(r.stcg) > 1e-9 ? "Short term" : "", Math.abs(r.ltcg) > 1e-9 ? "Long term" : ""]) &&
      passes(filters.sign, r.netGain >= 0 ? "Profit" : "Loss") &&
      passes(filters.pf, r.kind === "sale" ? salePlatforms.get(r.id) : "–"),
  );
  const periodQuery =
    period.value === "custom" ? `period=custom&from=${period.from}&to=${period.to}` : `period=${encodeURIComponent(period.value)}`;
  return { period, periodQuery, groups, filters, fq: filterQs(filters), rows };
}

export type MiscQuery = { period?: string; from?: string; to?: string; q?: string; mt?: string; sign?: string };

/** Misc rows (entries and dividends) with the Misc page's period, type, result and search; the CSV export reuses it. */
export function miscView(pf: Portfolio, query: MiscQuery, today: string) {
  const period = resolvePeriod(query, today);
  const dividendIds = new Set(pf.dividendEvents.map((d) => d.id));
  const typeOf = (r: RealisedRow) => miscTypeOf(r, dividendIds);
  const all = pf.rows.filter((r) => r.kind === "misc");
  const typeOptions = [...new Set(all.map(typeOf))].sort();
  const filters: Filters = readFilters(query, ["mt", "sign"], { mt: typeOptions, sign: RESULTS });
  const noteOf = new Map(pf.miscEvents.map((m) => [m.id, m.note]));
  const needle = (query.q ?? "").trim().toLowerCase();
  const rows = all.filter(
    (r) =>
      inPeriod(r.date, period) &&
      passes(filters.mt, typeOf(r)) &&
      passes(filters.sign, r.netGain >= 0 ? "Profit" : "Loss") &&
      (!needle || [typeOf(r), r.label, noteOf.get(r.id) ?? ""].some((s) => s.toLowerCase().includes(needle))),
  );
  const periodQuery =
    period.value === "custom" ? `period=custom&from=${period.from}&to=${period.to}` : `period=${encodeURIComponent(period.value)}`;
  return { period, periodQuery, filters, fq: filterQs(filters), typeOptions, all, rows, typeOf };
}
