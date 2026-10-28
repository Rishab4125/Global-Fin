// Corporate actions adjust a holding without a trade. Lots and sales stay exactly as entered; the adjustment is
// a "units factor" worked out on read, so every event can be seen and reversed.
import type { Lot } from "./fifo";
import type { AssetTypeId } from "./taxRules";

export type ActionType = "split" | "bonus" | "dividend";

export interface CorporateAction {
  id: string;
  assetId: string;
  type: ActionType;
  date: string;
  /** New units per old unit. 1:5 split: ratioOld 1, ratioNew 5. 1:1 bonus: 1 and 1. */
  ratioNew: number;
  ratioOld: number;
  /** Dividend amount (₹). */
  amount: number;
  /** Tax already deducted at source on a dividend (₹), for information. */
  tds: number;
  note: string;
}

/** Which event kinds each holding type can have. */
export const EVENT_TYPES: Partial<Record<AssetTypeId, ActionType[]>> = {
  equity: ["split", "bonus", "dividend"],
  gold_etf: ["split", "bonus", "dividend"],
  equity_mf: ["dividend"],
  debt_mf: ["dividend"],
};

const EPS = 1e-9;

export const splitFactor = (a: Pick<CorporateAction, "ratioNew" | "ratioOld">) => a.ratioNew / a.ratioOld;

/**
 * Units factor of a holding on `date`: the product of its splits dated on or before that day. A quantity entered
 * on `date` is in these units, so qty / unitsAt(date) is always in the holding's original units.
 */
export function unitsAt(actions: CorporateAction[], assetId: string, date: string): number {
  let u = 1;
  for (const a of actions) if (a.type === "split" && a.assetId === assetId && a.date <= date) u *= splitFactor(a);
  return u;
}

/** The units factor just before `date`, i.e. without a split dated on that day. */
export function unitsBefore(actions: CorporateAction[], assetId: string, date: string): number {
  let u = 1;
  for (const a of actions) if (a.type === "split" && a.assetId === assetId && a.date < date) u *= splitFactor(a);
  return u;
}

/** Units factor today, per holding, for the assets that have splits. */
export function unitsNow(actions: CorporateAction[], today: string): Map<string, number> {
  const out = new Map<string, number>();
  for (const a of actions) if (a.type === "split") out.set(a.assetId, unitsAt(actions, a.assetId, today));
  return out;
}

/** Stamp each lot with the units factor of its buy date. Lots of assets without splits get 1. */
export function withUnits<T extends Lot>(lots: T[], actions: CorporateAction[]): T[] {
  return lots.map((l) => ({ ...l, u: unitsAt(actions, l.assetId, l.buyDate) }));
}

export interface AllocatedSale {
  date: string;
  allocations: { lotId: string; qty: number }[];
}

/**
 * Units of one holding held just before `date`, in the units in force then. Lots bought before the day and not yet
 * sold by it; used to size a bonus and to check a split leaves whole shares.
 */
export function quantityHeldBefore(
  lots: Lot[],
  sales: AllocatedSale[],
  actions: CorporateAction[],
  assetId: string,
  date: string,
): number {
  const sold = new Map<string, number>();
  for (const s of sales) {
    if (s.date >= date) continue;
    for (const a of s.allocations) sold.set(a.lotId, (sold.get(a.lotId) ?? 0) + a.qty);
  }
  const u = unitsBefore(actions, assetId, date);
  let held = 0;
  for (const l of lots) {
    if (l.assetId !== assetId || l.buyDate >= date) continue;
    const rem = l.qty - (sold.get(l.id) ?? 0);
    if (rem > EPS) held += (rem * u) / (l.u ?? 1);
  }
  return held;
}

/** Bonus shares for a holding: whole shares only, the company settles any fraction in cash. */
export function bonusShares(held: number, ratioNew: number, ratioOld: number): number {
  return Math.floor((held * ratioNew) / ratioOld + EPS);
}

/** True when `qty` is a whole number (within floating-point noise). */
export const isWhole = (qty: number) => Math.abs(qty - Math.round(qty)) < 1e-6;
