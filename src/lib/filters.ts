/** Multi-select list filters kept in the URL, e.g. ?pf=Zerodha,Groww&ty=Equity. */

export type FilterQuery = Record<string, string | string[] | undefined>;
export type Filters = Record<string, string[]>;

/** "a,b" (or ["a,b", "c"]) -> ["a", "b", "c"], without blanks or repeats. */
export function parseMulti(v: string | string[] | undefined): string[] {
  const parts = (Array.isArray(v) ? v : [v ?? ""]).flatMap((s) => s.split(","));
  return [...new Set(parts.map((s) => s.trim()).filter(Boolean))];
}

/** Read the filters named in `ids`; values not in `allowed[id]` (when given) are dropped. */
export function readFilters(query: FilterQuery, ids: readonly string[], allowed: Filters = {}): Filters {
  const out: Filters = {};
  for (const id of ids) {
    const values = parseMulti(query[id]);
    out[id] = allowed[id] ? values.filter((v) => allowed[id].includes(v)) : values;
  }
  return out;
}

/** Filters as a query string without a leading "&", e.g. "pf=Zerodha%2CGroww". Empty when nothing is selected. */
export function filterQs(filters: Filters): string {
  return Object.entries(filters)
    .filter(([, v]) => v.length)
    .map(([k, v]) => `${k}=${encodeURIComponent(v.join(","))}`)
    .join("&");
}

/** Join query fragments with "&", skipping empty ones. */
export const joinQs = (...parts: (string | undefined)[]) => parts.filter(Boolean).join("&");

/** True when nothing is selected, or `value` (or any of its values) is selected. */
export function passes(selected: string[] | undefined, value: string | string[] | undefined): boolean {
  if (!selected?.length) return true;
  return (Array.isArray(value) ? value : [value ?? ""]).some((v) => selected.includes(v));
}

export const activeCount = (filters: Filters) => Object.values(filters).reduce((s, v) => s + v.length, 0);
