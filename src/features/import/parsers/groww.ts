import type { BrokerTrade, ParseResult } from "../types";
import { cell, findHeader, stableId, toIsoDate, toNumber } from "./common";

const REQUIRED = {
  type: ["type", "transactiontype", "side", "buysell", "tradetype"],
  qty: ["quantity", "qty"],
  date: ["executeddateandtime", "executeddate", "executiontime", "executedat", "orderdate", "tradedate", "date"],
};
const OPTIONAL = {
  symbol: ["symbol", "tradingsymbol"],
  name: ["stockname", "companyname", "scripname", "name"],
  isin: ["isin"],
  value: ["value", "amount", "tradevalue", "totalvalue"],
  price: ["price", "averageprice", "avgprice", "executionprice"],
  status: ["orderstatus", "status"],
  orderId: ["exchangeorderid", "orderid", "tradeid", "exchangeorderno"],
};

/** Groww stock order history: one row per executed order. */
export function parseGrowwOrders(rows: string[][]): ParseResult | null {
  const h = findHeader(rows, REQUIRED, OPTIONAL);
  if (!h) return null;
  const c = h.col;
  if ((c.symbol === undefined && c.name === undefined) || (c.value === undefined && c.price === undefined)) return null;

  const trades: BrokerTrade[] = [];
  const skipped: string[] = [];
  const idSeen = new Map<string, number>();
  const hashSeen = new Map<string, number>();

  for (const row of rows.slice(h.index + 1)) {
    const symbol = cell(row, c.symbol) || cell(row, c.name);
    const qty = toNumber(cell(row, c.qty));
    if (!symbol || !(qty > 0)) continue;

    const status = cell(row, c.status);
    if (status && !/exec|complete|fill|success/i.test(status)) {
      skipped.push(`${symbol}: order ${status.toLowerCase()}`);
      continue;
    }
    const side = cell(row, c.type).toLowerCase();
    const date = toIsoDate(cell(row, c.date));
    const value = toNumber(cell(row, c.value));
    const price = value >= 0 ? value / qty : toNumber(cell(row, c.price));
    if ((side !== "buy" && side !== "sell") || !date || !(price >= 0)) {
      skipped.push(`${symbol}: unreadable row`);
      continue;
    }

    const isin = cell(row, c.isin);
    const orderId = cell(row, c.orderId);
    let tradeId: string;
    if (orderId) {
      const n = (idSeen.get(orderId) ?? 0) + 1;
      idSeen.set(orderId, n);
      tradeId = n === 1 ? orderId : `${orderId}#${n}`;
    } else {
      tradeId = stableId([isin || symbol, date, side, qty, price.toFixed(4)], hashSeen);
    }
    trades.push({
      isin: isin || null,
      symbol,
      name: cell(row, c.name) || symbol,
      date,
      side,
      qty,
      price,
      tradeId,
    });
  }
  return { trades, skipped };
}
