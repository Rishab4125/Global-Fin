// The Holdings list: what is held, where, and what it cost. Pure, so filters, search, sort and grouping are testable.
import { ASSET_RULES, type AssetTypeId } from "../../domain/taxRules";
import { sortRows, type Dir } from "../../lib/sort";

const EPS = 1e-9;
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export interface ListLot {
  id: string;
  assetId: string;
  buyDate: string;
  qty: number;
  unitPrice: number;
  fees: number;
  platform?: string;
  /** Units factor of the buy date (splits). */
  u?: number;
}

export interface ListAsset {
  id: string;
  type: AssetTypeId;
  name: string;
  tags: string[];
}

export interface ListFilters {
  platform?: string[];
  category?: string[];
  exposure?: string[];
  tag?: string[];
}

export interface PlatformPart {
  platform: string;
  qty: number;
  cost: number;
}

export interface HoldingRow {
  id: string;
  name: string;
  type: AssetTypeId;
  category: string;
  platforms: string[];
  /** Units held now, after any splits. */
  qty: number;
  /** What the units still held cost, with fees. */
  cost: number;
  avgCost: number;
  lastBuy: string;
  tags: string[];
  /** The same holding split by where it is held. */
  byPlatform: PlatformPart[];
}

export interface HoldingList {
  rows: HoldingRow[];
  /** Cost of the whole portfolio, ignoring filters, so "% of portfolio" means the same thing in any view. */
  portfolioTotal: number;
}

const passes = (sel: string[] | undefined, v: string | string[]) =>
  !sel?.length || (Array.isArray(v) ? v : [v]).some((x) => sel.includes(x));

/**
 * One row per holding with something left. Cost is the FIFO remaining lots plus fees, each lot rounded once to the
 * paisa (the same rule as the dashboard mix, so the totals agree). Quantity is in today's units after splits.
 * Filters narrow the lots, so a platform filter shows only what is held there.
 */
export function buildHoldingRows(
  lots: ListLot[],
  sold: Map<string, number>,
  assets: Map<string, ListAsset>,
  unitsNow: Map<string, number>,
  filters: ListFilters = {},
): HoldingList {
  const acc = new Map<string, HoldingRow>();
  let portfolioTotal = 0;

  for (const l of lots) {
    const rem = l.qty - (sold.get(l.id) ?? 0);
    const a = assets.get(l.assetId);
    if (rem <= EPS || !a) continue;
    const rule = ASSET_RULES[a.type];
    const platform = l.platform ?? "Other";
    const cost = round2(rem * (l.unitPrice + l.fees / l.qty));
    portfolioTotal += cost;

    if (
      !passes(filters.platform, platform) ||
      !passes(filters.category, rule.category) ||
      !passes(filters.exposure, rule.exposure) ||
      !passes(filters.tag, a.tags)
    ) {
      continue;
    }

    const qty = (rem * (unitsNow.get(l.assetId) ?? 1)) / (l.u ?? 1);
    const row = acc.get(a.id) ?? {
      id: a.id,
      name: a.name,
      type: a.type,
      category: rule.category,
      platforms: [],
      qty: 0,
      cost: 0,
      avgCost: 0,
      lastBuy: l.buyDate,
      tags: a.tags,
      byPlatform: [],
    };
    row.qty += qty;
    row.cost += cost;
    row.lastBuy = l.buyDate > row.lastBuy ? l.buyDate : row.lastBuy;
    const part = row.byPlatform.find((p) => p.platform === platform);
    if (part) {
      part.qty += qty;
      part.cost += cost;
    } else row.byPlatform.push({ platform, qty, cost });
    acc.set(a.id, row);
  }

  const rows = [...acc.values()].map((r) => {
    const byPlatform = r.byPlatform
      .map((p) => ({ ...p, cost: round2(p.cost) }))
      .sort((x, y) => y.cost - x.cost || x.platform.localeCompare(y.platform));
    const cost = round2(byPlatform.reduce((s, p) => s + p.cost, 0));
    return {
      ...r,
      cost,
      avgCost: r.qty > 0 ? cost / r.qty : 0,
      platforms: byPlatform.map((p) => p.platform).sort(),
      byPlatform,
    };
  });
  return { rows, portfolioTotal: round2(portfolioTotal) };
}

/** Rows whose name, category, platform or tag contains the text, ignoring case. An empty search keeps everything. */
export function searchRows(rows: HoldingRow[], text: string): HoldingRow[] {
  const needle = text.trim().toLowerCase();
  if (!needle) return rows;
  return rows.filter((r) =>
    [r.name, r.category, ASSET_RULES[r.type].subType, ...r.platforms, ...r.tags].some((s) => s.toLowerCase().includes(needle)),
  );
}

export const SORT_KEYS = ["invested", "name", "qty", "avg", "recent"] as const;
export type SortKey = (typeof SORT_KEYS)[number];

const getters: Record<SortKey, (r: HoldingRow) => string | number> = {
  invested: (r) => r.cost,
  name: (r) => r.name,
  qty: (r) => r.qty,
  avg: (r) => r.avgCost,
  recent: (r) => r.lastBuy,
};

export const sortHoldingRows = (rows: HoldingRow[], key: SortKey, dir: Dir) => sortRows(rows, getters[key], dir);

export type GroupBy = "none" | "category" | "platform";
export const GROUP_OPTIONS: { value: GroupBy; label: string }[] = [
  { value: "none", label: "No grouping" },
  { value: "category", label: "Group by category" },
  { value: "platform", label: "Group by platform" },
];

export interface HoldingGroup {
  /** Empty for the single ungrouped list. */
  key: string;
  rows: HoldingRow[];
  /** Sum of the rows' cost. */
  cost: number;
}

/**
 * Split rows into groups, largest group first, keeping each group's rows in the order given. Grouping by platform puts a
 * holding on two platforms in both, each time showing only the part held there.
 */
export function groupHoldingRows(rows: HoldingRow[], by: GroupBy): HoldingGroup[] {
  if (by === "none") return [{ key: "", rows, cost: round2(rows.reduce((s, r) => s + r.cost, 0)) }];
  const groups = new Map<string, HoldingRow[]>();
  for (const r of rows) {
    if (by === "category") groups.set(r.category, [...(groups.get(r.category) ?? []), r]);
    else {
      for (const p of r.byPlatform) {
        const part: HoldingRow = {
          ...r,
          platforms: [p.platform],
          qty: p.qty,
          cost: p.cost,
          avgCost: p.qty > 0 ? p.cost / p.qty : 0,
          byPlatform: [p],
        };
        groups.set(p.platform, [...(groups.get(p.platform) ?? []), part]);
      }
    }
  }
  return [...groups.entries()]
    .map(([key, rs]) => ({ key, rows: rs, cost: round2(rs.reduce((s, r) => s + r.cost, 0)) }))
    .sort((a, b) => b.cost - a.cost || a.key.localeCompare(b.key));
}

/** The exposures and tags present, for the filter menus. */
export function filterOptions(assets: ListAsset[]) {
  return {
    categories: [...new Set(assets.map((a) => ASSET_RULES[a.type].category))].sort(),
    exposures: [...new Set(assets.map((a) => ASSET_RULES[a.type].exposure))].sort(),
    tags: [...new Set(assets.flatMap((a) => a.tags))].sort((a, b) => a.localeCompare(b)),
  };
}
