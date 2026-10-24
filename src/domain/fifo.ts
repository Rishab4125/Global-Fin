export interface Lot {
  id: string;
  assetId: string;
  buyDate: string;
  qty: number;
  unitPrice: number;
  fees: number;
  /** Where the purchase came from, e.g. "manual" or "zerodha_pnl". */
  source?: string;
}

export interface Allocation {
  lotId: string;
  qty: number;
}

const EPS = 1e-9;

/** Per-unit cost of a lot including its share of purchase fees. */
export function lotUnitCost(lot: Lot): number {
  return lot.unitPrice + lot.fees / lot.qty;
}

/**
 * Match a sale to buy lots, oldest first. `remaining` maps lotId -> units not yet sold.
 * Only lots bought on/before the sale date are eligible.
 */
export function allocateFifo(
  lots: Lot[],
  remaining: Map<string, number>,
  sellQty: number,
  sellDate: string,
): { allocations: Allocation[]; shortfall: number } {
  const eligible = lots
    .filter((l) => l.buyDate <= sellDate && (remaining.get(l.id) ?? 0) > EPS)
    .sort((a, b) => (a.buyDate < b.buyDate ? -1 : a.buyDate > b.buyDate ? 1 : 0));

  let need = sellQty;
  const allocations: Allocation[] = [];
  for (const lot of eligible) {
    if (need <= EPS) break;
    const take = Math.min(need, remaining.get(lot.id) ?? 0);
    allocations.push({ lotId: lot.id, qty: take });
    need -= take;
  }
  return { allocations, shortfall: Math.max(0, need) };
}

export interface Holding {
  assetId: string;
  qty: number;
  cost: number;
  avgCost: number;
}

export function computeHoldings(
  lots: Lot[],
  sold: Map<string, number>,
): Map<string, Holding> {
  const out = new Map<string, Holding>();
  for (const lot of lots) {
    const rem = lot.qty - (sold.get(lot.id) ?? 0);
    if (rem <= EPS) continue;
    const h = out.get(lot.assetId) ?? { assetId: lot.assetId, qty: 0, cost: 0, avgCost: 0 };
    h.qty += rem;
    h.cost += rem * lotUnitCost(lot);
    out.set(lot.assetId, h);
  }
  for (const h of out.values()) h.avgCost = h.qty > 0 ? h.cost / h.qty : 0;
  return out;
}
