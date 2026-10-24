import { randomUUID } from "node:crypto";
import { classifyTrade, type RowStatus } from "../../domain/brokerSync";
import { allocateFifo, type Lot } from "../../domain/fifo";
import type { BrokerTrade } from "./types";

const EPS = 1e-9;

export interface PlanAsset {
  id: string;
  name: string;
  type: string;
  isin: string | null;
}

export interface ExistingLot extends Lot {
  source: string;
}

export interface ExistingSale {
  id: string;
  assetId: string;
  source: string;
  allocations: { lotId: string; qty: number }[];
}

export type MatchKind = "isin" | "mapped" | "name" | "suggest" | "none";

export interface AssetMatch {
  key: string;
  symbol: string;
  name: string;
  isin: string | null;
  /** Existing asset id, or null when a new holding will be created. */
  assetId: string | null;
  kind: MatchKind;
}

export interface PlanInput {
  trades: BrokerTrade[];
  source: string;
  assets: PlanAsset[];
  lots: ExistingLot[];
  sales: ExistingSale[];
  importedKeys: Set<string>;
  manualKeys: Set<string>;
  /** assetKey -> existing asset id, or "new". Overrides automatic matching. */
  mapping: Map<string, string>;
  /** Trade keys of possible duplicates the user chose to import anyway. */
  includeDuplicates: Set<string>;
  /** Remove unsold/estimated kite_sync entries for the stocks being imported. */
  replaceEstimated: boolean;
}

export interface PlanRow {
  tradeKey: string | null;
  trade: BrokerTrade;
  assetKey: string;
  status: RowStatus | "error";
  message?: string;
  include: boolean;
}

export interface PlanLot {
  id: string;
  assetId: string;
  buyDate: string;
  qty: number;
  unitPrice: number;
  tradeId: string | null;
}

export interface PlanSale {
  id: string;
  assetId: string;
  sellDate: string;
  qty: number;
  price: number;
  tradeId: string | null;
  allocations: { lotId: string; qty: number }[];
}

export interface Plan {
  matches: AssetMatch[];
  rows: PlanRow[];
  newAssets: { id: string; name: string; isin: string | null }[];
  setIsin: { assetId: string; isin: string }[];
  removeLotIds: string[];
  removeSaleIds: string[];
  /** Estimated (kite_sync) entries that exist for the stocks in this import. */
  estimatedCount: number;
  lots: PlanLot[];
  sales: PlanSale[];
}

export const assetKeyOf = (t: { isin: string | null; symbol: string }) => t.isin ?? t.symbol;
export const tradeKeyOf = (source: string, t: BrokerTrade) => (t.tradeId ? `${source}:${t.tradeId}` : null);

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Decide which existing holding each broker stock belongs to, so the same stock is never created twice.
 * Order: explicit user mapping, ISIN, exact name/symbol, then a containment suggestion (e.g. RELIANCE vs
 * "Reliance Industries"). Each existing holding is claimed by at most one broker stock.
 */
export function resolveAssets(
  trades: Pick<BrokerTrade, "isin" | "symbol" | "name">[],
  assets: PlanAsset[],
  mapping: Map<string, string>,
): AssetMatch[] {
  const byKey = new Map<string, AssetMatch>();
  for (const t of trades) {
    const key = assetKeyOf(t);
    if (!byKey.has(key)) {
      byKey.set(key, { key, symbol: t.symbol, name: t.name, isin: t.isin, assetId: null, kind: "none" });
    }
  }
  const matches = [...byKey.values()];
  const claimed = new Set<string>();
  const pending = () => matches.filter((m) => m.kind === "none");

  for (const m of matches) {
    const v = mapping.get(m.key);
    if (v === "new") {
      m.kind = "mapped";
    } else if (v && assets.some((a) => a.id === v)) {
      m.assetId = v;
      m.kind = "mapped";
      claimed.add(v);
    }
  }
  for (const m of pending()) {
    const a = m.isin ? assets.find((x) => x.isin === m.isin && !claimed.has(x.id)) : undefined;
    if (a) {
      m.assetId = a.id;
      m.kind = "isin";
      claimed.add(a.id);
    }
  }
  const free = (m: AssetMatch) => (a: PlanAsset) => !claimed.has(a.id) && (!a.isin || a.isin === m.isin);
  for (const m of pending()) {
    const targets = new Set([norm(m.symbol), norm(m.name)]);
    const a = assets.filter(free(m)).find((x) => targets.has(norm(x.name)));
    if (a) {
      m.assetId = a.id;
      m.kind = "name";
      claimed.add(a.id);
    }
  }
  for (const m of pending()) {
    const s = norm(m.symbol);
    if (s.length < 3) continue;
    const a = assets.filter(free(m)).find((x) => {
      const n = norm(x.name);
      return n.length >= 3 && (n.includes(s) || s.includes(n));
    });
    if (a) {
      m.assetId = a.id;
      m.kind = "suggest";
      claimed.add(a.id);
    }
  }
  return matches;
}

export function buildPlan(input: PlanInput): Plan {
  const { trades, source, assets, importedKeys, manualKeys, includeDuplicates } = input;
  const matches = resolveAssets(trades, assets, input.mapping);
  const matchByKey = new Map(matches.map((m) => [m.key, m]));

  const newAssets: Plan["newAssets"] = [];
  const setIsin: Plan["setIsin"] = [];
  const usedIsins = new Set(assets.map((a) => a.isin).filter((x): x is string => !!x));
  const idByKey = new Map<string, string>();
  for (const m of matches) {
    if (m.assetId) {
      idByKey.set(m.key, m.assetId);
      const a = assets.find((x) => x.id === m.assetId)!;
      if (!a.isin && m.isin && !usedIsins.has(m.isin)) {
        setIsin.push({ assetId: a.id, isin: m.isin });
        usedIsins.add(m.isin);
      }
    } else {
      const id = randomUUID();
      idByKey.set(m.key, id);
      const isin = m.isin && !usedIsins.has(m.isin) ? m.isin : null;
      if (isin) usedIsins.add(isin);
      newAssets.push({ id, name: m.symbol, isin });
    }
  }

  const seen = new Set<string>();
  const rows: PlanRow[] = trades.map((trade) => {
    const assetKey = assetKeyOf(trade);
    const tradeKey = tradeKeyOf(source, trade);
    const existingId = matchByKey.get(assetKey)?.assetId ?? null;
    let status: RowStatus = tradeKey ? classifyTrade(tradeKey, existingId, trade, importedKeys, manualKeys) : "new";
    if (tradeKey && status === "new") {
      if (seen.has(tradeKey)) status = "imported";
      seen.add(tradeKey);
    }
    const include = status === "new" || (status === "possible_duplicate" && !!tradeKey && includeDuplicates.has(tradeKey));
    return { tradeKey, trade, assetKey, status, include };
  });

  const touched = new Set(
    rows.filter((r) => r.include).map((r) => matchByKey.get(r.assetKey)?.assetId).filter((x): x is string => !!x),
  );
  const estSales = input.sales.filter((s) => s.source === "kite_sync" && touched.has(s.assetId));
  const estLots = input.lots.filter((l) => l.source === "kite_sync" && touched.has(l.assetId));
  const estimatedCount = estSales.length + estLots.length;

  const removeSaleIds = new Set<string>();
  const removeLotIds = new Set<string>();
  if (input.replaceEstimated) {
    for (const s of estSales) removeSaleIds.add(s.id);
  }

  const sold = new Map<string, number>();
  for (const s of input.sales) {
    if (removeSaleIds.has(s.id)) continue;
    for (const a of s.allocations) sold.set(a.lotId, (sold.get(a.lotId) ?? 0) + a.qty);
  }
  if (input.replaceEstimated) {
    for (const l of estLots) if ((sold.get(l.id) ?? 0) <= EPS) removeLotIds.add(l.id);
  }

  const lots: Lot[] = input.lots.filter((l) => !removeLotIds.has(l.id));
  const remaining = new Map(lots.map((l) => [l.id, l.qty - (sold.get(l.id) ?? 0)]));
  const newLots: PlanLot[] = [];
  const newSales: PlanSale[] = [];

  const order = rows
    .filter((r) => r.include)
    .sort((a, b) =>
      a.trade.date === b.trade.date ? (a.trade.side === b.trade.side ? 0 : a.trade.side === "buy" ? -1 : 1) : a.trade.date < b.trade.date ? -1 : 1,
    );

  for (const r of order) {
    const assetId = idByKey.get(r.assetKey)!;
    const t = r.trade;
    if (t.side === "buy") {
      const lot: PlanLot = { id: randomUUID(), assetId, buyDate: t.date, qty: t.qty, unitPrice: t.price, tradeId: t.tradeId };
      newLots.push(lot);
      lots.push({ id: lot.id, assetId, buyDate: t.date, qty: t.qty, unitPrice: t.price, fees: 0 });
      remaining.set(lot.id, t.qty);
    } else {
      const own = lots.filter((l) => l.assetId === assetId);
      const { allocations, shortfall } = allocateFifo(own, remaining, t.qty, t.date);
      if (shortfall > EPS) {
        r.status = "error";
        r.include = false;
        r.message = `Only ${t.qty - shortfall} units available to sell on or before ${t.date}. Import the earlier buys first.`;
        continue;
      }
      for (const a of allocations) remaining.set(a.lotId, (remaining.get(a.lotId) ?? 0) - a.qty);
      newSales.push({ id: randomUUID(), assetId, sellDate: t.date, qty: t.qty, price: t.price, tradeId: t.tradeId, allocations });
    }
  }

  return {
    matches,
    rows,
    newAssets,
    setIsin,
    removeLotIds: [...removeLotIds],
    removeSaleIds: [...removeSaleIds],
    estimatedCount,
    lots: newLots,
    sales: newSales,
  };
}
