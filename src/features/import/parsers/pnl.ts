import type { BrokerTrade, ParseResult } from "../types";
import { cell, findHeader, stableId, toIsoDate, toNumber } from "./common";

const REQUIRED = {
  entry: ["entrydate", "buydate", "purchasedate"],
  exit: ["exitdate", "selldate", "saledate"],
  qty: ["quantity", "qty"],
};
const OPTIONAL = {
  symbol: ["symbol", "tradingsymbol"],
  name: ["stockname", "companyname", "scripname", "name"],
  isin: ["isin"],
  buyValue: ["buyvalue", "buyamount", "purchasevalue"],
  sellValue: ["sellvalue", "sellamount", "salevalue"],
  buyPrice: ["buyprice", "buyaverage", "avgbuyprice", "buyavgprice"],
  sellPrice: ["sellprice", "sellaverage", "avgsellprice", "sellavgprice"],
};

/**
 * Profit & loss report with one row per closed position and both dates, as in Zerodha Console's
 * "Tradewise Exits" and Groww's stock P&L. Each row becomes a buy and a sell. Summary-only reports
 * (no dates) return null because they cannot create dated buys.
 */
export function parsePnlRows(rows: string[][]): ParseResult | null {
  const h = findHeader(rows, REQUIRED, OPTIONAL);
  if (!h) return null;
  const c = h.col;
  const hasName = c.symbol !== undefined || c.name !== undefined;
  const hasBuy = c.buyValue !== undefined || c.buyPrice !== undefined;
  const hasSell = c.sellValue !== undefined || c.sellPrice !== undefined;
  if (!hasName || !hasBuy || !hasSell) return null;

  const trades: BrokerTrade[] = [];
  const skipped: string[] = [];
  const seen = new Map<string, number>();

  for (const row of rows.slice(h.index + 1)) {
    const symbol = cell(row, c.symbol) || cell(row, c.name);
    const qty = toNumber(cell(row, c.qty));
    if (!symbol || !(qty > 0)) continue;

    const isin = cell(row, c.isin);
    if (c.isin !== undefined && !isin) {
      skipped.push(`${symbol}: no ISIN (not a stock or fund)`);
      continue;
    }
    const entry = toIsoDate(cell(row, c.entry));
    const exit = toIsoDate(cell(row, c.exit));
    if (!entry || !exit) {
      skipped.push(`${symbol}: unreadable dates`);
      continue;
    }
    if (entry > exit) {
      skipped.push(`${symbol}: sold before it was bought (short sale)`);
      continue;
    }

    const price = (valueCol: number | undefined, priceCol: number | undefined) => {
      const value = toNumber(cell(row, valueCol));
      return value >= 0 ? value / qty : toNumber(cell(row, priceCol));
    };
    const buyPrice = price(c.buyValue, c.buyPrice);
    const sellPrice = price(c.sellValue, c.sellPrice);
    if (!(buyPrice >= 0) || !(sellPrice >= 0)) {
      skipped.push(`${symbol}: missing buy or sell amount`);
      continue;
    }

    const id = stableId([isin || symbol, entry, exit, qty, buyPrice.toFixed(4), sellPrice.toFixed(4)], seen);
    const name = cell(row, c.name) || symbol;
    const base = { isin: isin || null, symbol, name, qty };
    trades.push({ ...base, date: entry, side: "buy", price: buyPrice, tradeId: `${id}:b` });
    trades.push({ ...base, date: exit, side: "sell", price: sellPrice, tradeId: `${id}:s` });
  }
  return { trades, skipped };
}
