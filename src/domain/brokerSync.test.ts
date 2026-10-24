import { describe, expect, it } from "vitest";
import { classifyTrade, diffHoldings, manualKey } from "./brokerSync";
import { parseZerodhaTradebook } from "../features/import/parsers/zerodha";

const kite = (isin: string, qty: number, avg = 100, last = 110) => ({
  isin,
  symbol: isin,
  qty,
  avgPrice: avg,
  lastPrice: last,
});

describe("diffHoldings", () => {
  it("adds missing quantity at the broker average price", () => {
    const out = diffHoldings([kite("A", 10, 50)], [{ isin: "A", symbol: "A", qty: 4 }]);
    expect(out).toEqual([{ kind: "add", isin: "A", symbol: "A", qty: 6, price: 50 }]);
  });

  it("reduces excess quantity at the last price", () => {
    const out = diffHoldings([kite("A", 3, 50, 70)], [{ isin: "A", symbol: "A", qty: 5 }]);
    expect(out).toEqual([{ kind: "reduce", isin: "A", symbol: "A", qty: 2, price: 70 }]);
  });

  it("does nothing when quantities match, so a second sync is a no-op", () => {
    expect(diffHoldings([kite("A", 5)], [{ isin: "A", symbol: "A", qty: 5 }])).toEqual([]);
  });

  it("sells out holdings that no longer appear at the broker", () => {
    const out = diffHoldings([], [{ isin: "B", symbol: "B", qty: 7 }]);
    expect(out).toEqual([{ kind: "reduce", isin: "B", symbol: "B", qty: 7, price: 0 }]);
  });

  it("ignores duplicate ISINs in the broker response", () => {
    expect(diffHoldings([kite("A", 5), kite("A", 5)], []).length).toBe(1);
  });
});

describe("classifyTrade", () => {
  const t = { date: "2025-01-02", side: "buy", qty: 10, price: 100 };
  it("flags already imported ids", () => {
    expect(classifyTrade("z:1", "a1", t, new Set(["z:1"]), new Set())).toBe("imported");
  });
  it("flags a matching hand-entered trade", () => {
    const manual = new Set([manualKey("a1", t.date, t.side, t.qty, t.price)]);
    expect(classifyTrade("z:2", "a1", t, new Set(), manual)).toBe("possible_duplicate");
  });
  it("treats everything else as new", () => {
    expect(classifyTrade("z:3", null, t, new Set(), new Set())).toBe("new");
  });
});

describe("parseZerodhaTradebook", () => {
  const csv = [
    "symbol,isin,trade_date,exchange,segment,series,trade_type,auction,quantity,price,trade_id,order_id,order_execution_time",
    "RELIANCE,INE002A01018,2025-01-02,NSE,EQ,EQ,buy,false,10,1200.5,111,900,2025-01-02T09:30:00",
    "RELIANCE,INE002A01018,2025-02-03,NSE,EQ,EQ,sell,false,4,1300,112,901,2025-02-03T10:00:00",
    "NIFTY25JANFUT,,2025-01-02,NFO,FO,,buy,false,50,100,113,902,2025-01-02T09:31:00",
  ].join("\n");

  it("parses equity trades and skips derivatives", () => {
    const r = parseZerodhaTradebook(csv);
    expect(r.trades.map((x) => [x.side, x.qty, x.tradeId])).toEqual([
      ["buy", 10, "111"],
      ["sell", 4, "112"],
    ]);
    expect(r.skipped.length).toBe(1);
  });

  it("rejects a file with the wrong layout", () => {
    expect(parseZerodhaTradebook("a,b\n1,2").error).toBeTruthy();
  });
});
