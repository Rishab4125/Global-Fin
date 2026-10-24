import { parseCsv, toRecords } from "../csv";
import type { BrokerTrade, ParseResult } from "../types";

const ISO = /^\d{4}-\d{2}-\d{2}/;

function toIso(raw: string): string | null {
  if (ISO.test(raw)) return raw.slice(0, 10);
  const m = raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : null;
}

/** Zerodha Console > Reports > Tradebook CSV. */
export function parseZerodhaTradebook(text: string): ParseResult {
  const records = toRecords(parseCsv(text), (c) => {
    const h = c.map((x) => x.trim().toLowerCase());
    return h.includes("symbol") && h.includes("trade_id") && h.includes("trade_type");
  });
  if (!records) {
    return {
      trades: [],
      skipped: [],
      error: "This doesn't look like a Zerodha Tradebook CSV (expected symbol, trade_id, trade_type columns).",
    };
  }

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
    const date = toIso(r["trade_date"] ?? "");
    const qty = Number(r["quantity"]);
    const price = Number(r["price"]);
    const tradeId = r["trade_id"];
    if ((side !== "buy" && side !== "sell") || !date || !(qty > 0) || !(price >= 0) || !tradeId) {
      skipped.push(`${symbol}: unreadable row`);
      continue;
    }
    trades.push({
      isin: r["isin"] || null,
      symbol,
      name: symbol,
      date,
      side,
      qty,
      price,
      tradeId,
    });
  }
  return { trades, skipped };
}
