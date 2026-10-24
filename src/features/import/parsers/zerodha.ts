import { parseCsv, toRecords } from "../csv";
import type { BrokerTrade, ParseResult } from "../types";
import { toIsoDate } from "./common";

/** Zerodha Console > Reports > Tradebook. Returns null when the sheet has a different layout. */
export function parseZerodhaTradebookRows(rows: string[][]): ParseResult | null {
  const records = toRecords(rows, (c) => {
    const h = c.map((x) => x.trim().toLowerCase());
    return h.includes("symbol") && h.includes("trade_id") && h.includes("trade_type");
  });
  if (!records) return null;

  const trades: BrokerTrade[] = [];
  const skipped: string[] = [];
  for (const r of records) {
    const symbol = r["symbol"];
    if (!symbol) continue;
    const segment = (r["segment"] ?? "EQ").toUpperCase();
    if (segment !== "EQ") {
      skipped.push(`${symbol}: ${segment} trade (only equity is imported)`);
      continue;
    }
    const side = (r["trade_type"] ?? "").toLowerCase();
    const date = toIsoDate(r["trade_date"] ?? "");
    const qty = Number(r["quantity"]);
    const price = Number(r["price"]);
    const tradeId = r["trade_id"];
    if ((side !== "buy" && side !== "sell") || !date || !(qty > 0) || !(price >= 0) || !tradeId) {
      skipped.push(`${symbol}: unreadable row`);
      continue;
    }
    trades.push({ isin: r["isin"] || null, symbol, name: symbol, date, side, qty, price, tradeId });
  }
  return { trades, skipped };
}

export function parseZerodhaTradebook(text: string): ParseResult {
  return (
    parseZerodhaTradebookRows(parseCsv(text)) ?? {
      trades: [],
      skipped: [],
      error: "This doesn't look like a Zerodha Tradebook CSV (expected symbol, trade_id, trade_type columns).",
    }
  );
}
