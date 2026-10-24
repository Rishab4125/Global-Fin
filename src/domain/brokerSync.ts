const EPS = 1e-6;

export interface KiteHolding {
  isin: string;
  symbol: string;
  qty: number;
  avgPrice: number;
  lastPrice: number;
}

export interface AppPosition {
  isin: string;
  symbol: string;
  qty: number;
}

export type SyncAction =
  | { kind: "add"; isin: string; symbol: string; qty: number; price: number }
  | { kind: "reduce"; isin: string; symbol: string; qty: number; price: number };

/**
 * Compare broker holdings with what the app holds, per ISIN. Equal quantities produce no action,
 * so running a sync twice in a row changes nothing the second time.
 */
export function diffHoldings(kite: KiteHolding[], app: AppPosition[]): SyncAction[] {
  const appByIsin = new Map(app.map((p) => [p.isin, p]));
  const actions: SyncAction[] = [];
  const seen = new Set<string>();

  for (const h of kite) {
    if (!h.isin || seen.has(h.isin)) continue;
    seen.add(h.isin);
    const have = appByIsin.get(h.isin)?.qty ?? 0;
    const diff = h.qty - have;
    if (diff > EPS) actions.push({ kind: "add", isin: h.isin, symbol: h.symbol, qty: diff, price: h.avgPrice });
    else if (diff < -EPS) {
      actions.push({ kind: "reduce", isin: h.isin, symbol: h.symbol, qty: -diff, price: h.lastPrice });
    }
  }

  for (const p of app) {
    if (seen.has(p.isin) || p.qty <= EPS) continue;
    actions.push({ kind: "reduce", isin: p.isin, symbol: p.symbol, qty: p.qty, price: 0 });
  }
  return actions;
}

export type RowStatus = "new" | "imported" | "possible_duplicate";

export const manualKey = (assetId: string, date: string, side: string, qty: number, price: number) =>
  `${assetId}|${date}|${side}|${qty.toFixed(4)}|${price.toFixed(4)}`;

/** Already-imported id wins; otherwise a matching hand-entered trade is flagged for the user to decide. */
export function classifyTrade(
  tradeKey: string,
  assetId: string | null,
  t: { date: string; side: string; qty: number; price: number },
  importedKeys: Set<string>,
  manualKeys: Set<string>,
): RowStatus {
  if (importedKeys.has(tradeKey)) return "imported";
  if (assetId && manualKeys.has(manualKey(assetId, t.date, t.side, t.qty, t.price))) return "possible_duplicate";
  return "new";
}
