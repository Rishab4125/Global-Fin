import type { BrokerTrade, ParseResult } from "../types";
import { cell, findHeader, norm, stableId, toIsoDate, toNumber } from "./common";

const REQUIRED = {
  symbol: ["symbol"],
  isin: ["isin"],
  qty: ["quantity"],
  buyValue: ["buyvalue"],
  sellValue: ["sellvalue"],
};
const OPTIONAL = {
  openQty: ["openquantity"],
  openValue: ["openvalue"],
};

export type PnlLeg = "b" | "s" | "o";

/**
 * Trade ids carry the report period so a later import can tell which period a stored trade came from:
 * "INE002A01018~2025-12-01~2026-10-27:b". A repeated ISIN in one report gets "#2", "#3"...
 */
export const pnlTradeId = (isin: string, start: string, end: string, nth: number, leg: PnlLeg) =>
  `${isin}~${start}~${end}${nth > 1 ? `#${nth}` : ""}:${leg}`;

export function parsePnlTradeId(id: string | null): { isin: string; start: string; end: string; leg: PnlLeg } | null {
  const m = id?.match(/^([^~]+)~(\d{4}-\d{2}-\d{2})~(\d{4}-\d{2}-\d{2})(?:#\d+)?:([bso])$/);
  return m ? { isin: m[1], start: m[2], end: m[3], leg: m[4] as PnlLeg } : null;
}

/** "P&L Statement for Equity from 2025-12-01 to 2026-10-27" -> the two dates. */
function reportPeriod(rows: string[][]): [string, string] | null {
  for (const row of rows.slice(0, 40)) {
    for (const text of row) {
      const m = text.match(/\bfrom\s+(\S+)\s+to\s+(\S+)/i);
      const a = m && toIsoDate(m[1]);
      const b = m && toIsoDate(m[2]);
      if (a && b) return a <= b ? [a, b] : [b, a];
    }
  }
  return null;
}

/**
 * Zerodha Console > Reports > P&L (Equity sheet). It lists one row per stock with quantities and values but no
 * trade dates, so trades are dated by the report period: units bought are dated the period start and units
 * sold the period end. Download one financial year at a time to keep gains in the right year.
 *
 * Per stock: realised units become a buy and a sell; units still held (open quantity) become a buy at cost.
 */
export function parseZerodhaPnl(rows: string[][]): ParseResult | null {
  const h = findHeader(rows, REQUIRED, OPTIONAL);
  if (!h) return null;
  const c = h.col;
  // The dated Tax P&L has these columns; it is a different report.
  if (rows[h.index].some((x) => ["entrydate", "exitdate"].includes(norm(x)))) return null;

  const period = reportPeriod(rows);
  if (!period) {
    return { trades: [], skipped: [], error: "Couldn't find the report period (From … to …) in this P&L file." };
  }
  const [start, end] = period;

  const trades: BrokerTrade[] = [];
  const skipped: string[] = [];
  const seen = new Map<string, number>();
  const legacySeen = new Map<string, number>();

  for (const row of rows.slice(h.index + 1)) {
    const symbol = cell(row, c.symbol);
    const isin = cell(row, c.isin);
    if (!symbol || !isin) continue;

    const base = { isin, symbol, name: symbol };
    const qty = toNumber(cell(row, c.qty));
    const buyValue = toNumber(cell(row, c.buyValue));
    const sellValue = toNumber(cell(row, c.sellValue));
    const openQty = toNumber(cell(row, c.openQty));
    const openValue = toNumber(cell(row, c.openValue));
    const nth = (seen.get(isin) ?? 0) + 1;
    seen.set(isin, nth);
    // Earlier versions stored a hash of isin and period instead.
    const legacy = stableId([isin, start, end], legacySeen);

    if (qty > 0) {
      if (buyValue >= 0 && sellValue >= 0) {
        trades.push({ ...base, qty, date: start, side: "buy", price: buyValue / qty, tradeId: pnlTradeId(isin, start, end, nth, "b"), legacyTradeId: `${legacy}:b` });
        trades.push({ ...base, qty, date: end, side: "sell", price: sellValue / qty, tradeId: pnlTradeId(isin, start, end, nth, "s"), legacyTradeId: `${legacy}:s` });
      } else {
        skipped.push(`${symbol}: missing buy or sell value`);
      }
    }
    if (openQty > 0) {
      if (openValue >= 0) {
        trades.push({ ...base, qty: openQty, date: start, side: "buy", price: openValue / openQty, tradeId: pnlTradeId(isin, start, end, nth, "o"), legacyTradeId: `${legacy}:o` });
      } else {
        skipped.push(`${symbol}: missing open value`);
      }
    }
  }
  return { trades, skipped };
}
