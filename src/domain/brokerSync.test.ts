import { describe, expect, it } from "vitest";
import { classifyTrade, diffHoldings, manualKey } from "./brokerSync";

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
