export type Dir = "asc" | "desc";

export interface SortState<K extends string> {
  key: K;
  dir: Dir;
}

/** Read ?sort= and ?dir= from the URL, falling back when the column isn't one of `allowed`. */
export function parseSort<K extends string>(
  query: { sort?: string; dir?: string },
  allowed: readonly K[],
  fallback: SortState<K>,
): SortState<K> {
  const key = allowed.find((k) => k === query.sort);
  if (!key) return fallback;
  return { key, dir: query.dir === "asc" || query.dir === "desc" ? query.dir : fallback.dir };
}

export function sortRows<T>(rows: T[], get: (row: T) => string | number, dir: Dir): T[] {
  const sign = dir === "asc" ? 1 : -1;
  return rows
    .map((row, i) => ({ row, i, v: get(row) }))
    .sort((a, b) => {
      const c =
        typeof a.v === "number" && typeof b.v === "number"
          ? a.v - b.v
          : String(a.v).localeCompare(String(b.v), undefined, { sensitivity: "base", numeric: true });
      return c !== 0 ? c * sign : a.i - b.i;
    })
    .map((x) => x.row);
}
