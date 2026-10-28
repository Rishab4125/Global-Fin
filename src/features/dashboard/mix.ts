// The Mix card and the Upcoming list. Pure, so the three views of the mix always agree and can be tested.
import { ASSET_RULES, type AssetTypeId } from "../../domain/taxRules";

const EPS = 1e-9;
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export type MixView = "Platform" | "Category" | "Exposure";
export const MIX_VIEWS: MixView[] = ["Platform", "Category", "Exposure"];

export interface MixLot {
  id: string;
  assetId: string;
  qty: number;
  unitPrice: number;
  fees: number;
  platform?: string;
}

export interface MixAsset {
  id: string;
  type: AssetTypeId;
  name: string;
  details?: Record<string, unknown>;
}

export interface MixRow {
  key: string;
  /** Cost of what is still held, in rupees and paise. */
  cost: number;
  /** Share of the total, 0 to 100, from unrounded numbers. */
  share: number;
}

export interface Mix {
  /** Cost of everything still held. Equal to the sum of the rows in each view. */
  total: number;
  /** Holdings with something left. */
  holdingIds: string[];
  /** Cost per holding, largest first. */
  byHolding: { id: string; cost: number }[];
  byPlatform: MixRow[];
  byCategory: MixRow[];
  byExposure: MixRow[];
}

export interface MixFilter {
  /** Selected categories; empty means all. */
  category?: string[];
  /** Selected platforms; empty means all. */
  platform?: string[];
}

const passes = (sel: string[] | undefined, v: string) => !sel?.length || sel.includes(v);

function rows(map: Map<string, number>, total: number): MixRow[] {
  return [...map.entries()]
    .map(([key, cost]) => ({ key, cost, share: total > 0 ? (cost / total) * 100 : 0 }))
    .sort((a, b) => b.cost - a.cost || a.key.localeCompare(b.key));
}

/**
 * Cost of the units still held (FIFO remaining lots plus fees), split by platform, category and exposure.
 * Each remaining lot contributes one rounded amount to all three views, so the views always add up to the same total,
 * and a holding on two platforms is shared between them by lot.
 */
export function computeMix(
  lots: MixLot[],
  sold: Map<string, number>,
  assets: Map<string, MixAsset>,
  filter: MixFilter = {},
): Mix {
  const platform = new Map<string, number>();
  const category = new Map<string, number>();
  const exposure = new Map<string, number>();
  const holding = new Map<string, number>();
  let total = 0;

  for (const l of lots) {
    const rem = l.qty - (sold.get(l.id) ?? 0);
    const a = assets.get(l.assetId);
    if (rem <= EPS || !a) continue;
    const rule = ASSET_RULES[a.type];
    const plat = l.platform ?? "Other";
    if (!passes(filter.category, rule.category) || !passes(filter.platform, plat)) continue;
    // Same unit cost as holdings use: price plus this lot's share of its fees.
    const part = round2(rem * (l.unitPrice + l.fees / l.qty));
    total += part;
    platform.set(plat, (platform.get(plat) ?? 0) + part);
    category.set(rule.category, (category.get(rule.category) ?? 0) + part);
    exposure.set(rule.exposure, (exposure.get(rule.exposure) ?? 0) + part);
    holding.set(a.id, (holding.get(a.id) ?? 0) + part);
  }

  const fix = (m: Map<string, number>) => new Map([...m].map(([k, v]) => [k, round2(v)]));
  total = round2(total);
  return {
    total,
    holdingIds: [...holding.keys()],
    byHolding: [...holding.entries()].map(([id, cost]) => ({ id, cost: round2(cost) })).sort((a, b) => b.cost - a.cost),
    byPlatform: rows(fix(platform), total),
    byCategory: rows(fix(category), total),
    byExposure: rows(fix(exposure), total),
  };
}

export const rowsFor = (mix: Mix, view: MixView): MixRow[] =>
  view === "Platform" ? mix.byPlatform : view === "Category" ? mix.byCategory : mix.byExposure;

export interface Maturity {
  id: string;
  name: string;
  date: string;
  daysLeft: number;
}

const dayNumber = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
};

/**
 * Deposits and bonds still held that mature within `days` of today, soonest first. A maturity date comes from the
 * details saved when the investment was added.
 */
export function upcomingMaturities(
  assets: MixAsset[],
  heldIds: Set<string>,
  today: string,
  days = 90,
): Maturity[] {
  const out: Maturity[] = [];
  for (const a of assets) {
    const date = a.details?.maturity;
    if (!heldIds.has(a.id) || typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const daysLeft = dayNumber(date) - dayNumber(today);
    if (daysLeft >= 0 && daysLeft <= days) out.push({ id: a.id, name: a.name, date, daysLeft });
  }
  return out.sort((a, b) => a.daysLeft - b.daysLeft || a.name.localeCompare(b.name));
}
