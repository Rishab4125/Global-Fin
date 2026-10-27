import type { RealisedRow } from "@/domain/gains";
import { inPeriod, resolvePeriod } from "@/domain/period";
import { ASSET_RULES } from "@/domain/taxRules";
import { platformOf } from "@/domain/platform";
import { filterQs, passes, PLATFORMS, readFilters, type Filters } from "@/lib/filters";
import type { Portfolio } from "@/features/portfolio/data";

export const TERMS = ["Short term", "Long term"];
export const RESULTS = ["Profit", "Loss"];

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
  [...new Set(rows.map((r) => ASSET_RULES[r.assetType].group))].sort();

/** Period and list filters for the realised report; shared by the page and the CSV export so they always agree. */
export function realisedView(pf: Portfolio, query: RealisedQuery, today: string) {
  const period = resolvePeriod({ ...query, period: query.period ?? "all" }, today);
  const groups = realisedGroups(pf.rows);
  const filters: Filters = readFilters(query, ["ty", "term", "sign", "pf"], {
    ty: groups,
    term: TERMS,
    sign: RESULTS,
    pf: PLATFORMS,
  });
  const saleSource = new Map(pf.saleEvents.map((s) => [s.id, s.source]));
  const rows = pf.rows.filter(
    (r) =>
      inPeriod(r.date, period) &&
      passes(filters.ty, ASSET_RULES[r.assetType].group) &&
      passes(filters.term, [Math.abs(r.stcg) > 1e-9 ? "Short term" : "", Math.abs(r.ltcg) > 1e-9 ? "Long term" : ""]) &&
      passes(filters.sign, r.netGain >= 0 ? "Profit" : "Loss") &&
      passes(filters.pf, r.kind === "sale" ? platformOf(saleSource.get(r.id)) : "–"),
  );
  const periodQuery =
    period.value === "custom" ? `period=custom&from=${period.from}&to=${period.to}` : `period=${encodeURIComponent(period.value)}`;
  return { period, periodQuery, groups, filters, fq: filterQs(filters), rows };
}
