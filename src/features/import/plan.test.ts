import { describe, expect, it } from "vitest";
import { manualKey } from "../../domain/brokerSync";
import { buildPlan, type PlanInput } from "./plan";
import type { BrokerTrade } from "./types";

const trade = (over: Partial<BrokerTrade>): BrokerTrade => ({
  isin: "INE002A01018",
  symbol: "RELIANCE",
  name: "RELIANCE",
  date: "2025-01-02",
  side: "buy",
  qty: 10,
  price: 100,
  tradeId: "t1",
  ...over,
});

const base = (over: Partial<PlanInput> = {}): PlanInput => ({
  trades: [],
  source: "zerodha_csv",
  assets: [],
  lots: [],
  sales: [],
  importedKeys: new Set(),
  manualKeys: new Set(),
  mapping: new Map(),
  includeDuplicates: new Set(),
  replaceEstimated: false,
  ...over,
});

describe("buildPlan duplicate protection", () => {
  it("creates one asset and two lots for repeated buys of the same stock", () => {
    const p = buildPlan(base({ trades: [trade({ tradeId: "a" }), trade({ tradeId: "b", date: "2025-01-03" })] }));
    expect(p.newAssets).toHaveLength(1);
    expect(p.lots).toHaveLength(2);
  });

  it("skips trades whose id was already imported", () => {
    const p = buildPlan(base({ trades: [trade({})], importedKeys: new Set(["zerodha_csv:t1"]) }));
    expect(p.rows[0].status).toBe("imported");
    expect(p.lots).toHaveLength(0);
    expect(p.newAssets).toHaveLength(1);
  });

  it("skips a trade id repeated inside one file", () => {
    const p = buildPlan(base({ trades: [trade({}), trade({})] }));
    expect(p.lots).toHaveLength(1);
  });

  it("reuses an existing holding by ISIN and never creates a second asset", () => {
    const assets = [{ id: "a1", name: "Reliance Industries", type: "equity", isin: "INE002A01018" }];
    const p = buildPlan(base({ trades: [trade({})], assets }));
    expect(p.newAssets).toHaveLength(0);
    expect(p.lots[0].assetId).toBe("a1");
  });

  it("matches a hand-entered holding by name and links its ISIN", () => {
    const assets = [{ id: "a1", name: "reliance", type: "equity", isin: null }];
    const p = buildPlan(base({ trades: [trade({})], assets }));
    expect(p.newAssets).toHaveLength(0);
    expect(p.setIsin).toEqual([{ assetId: "a1", isin: "INE002A01018" }]);
  });

  it("suggests an existing holding whose name contains the symbol", () => {
    const assets = [{ id: "a1", name: "Reliance Industries", type: "equity", isin: null }];
    const p = buildPlan(base({ trades: [trade({})], assets }));
    expect(p.matches[0]).toMatchObject({ assetId: "a1", kind: "suggest" });
    expect(p.newAssets).toHaveLength(0);
  });

  it("honours an explicit 'new' mapping", () => {
    const assets = [{ id: "a1", name: "Reliance Industries", type: "equity", isin: null }];
    const p = buildPlan(base({ trades: [trade({})], assets, mapping: new Map([["INE002A01018", "new"]]) }));
    expect(p.newAssets).toHaveLength(1);
  });

  it("flags a hand-entered twin as a possible duplicate and skips it by default", () => {
    const assets = [{ id: "a1", name: "RELIANCE", type: "equity", isin: "INE002A01018" }];
    const manualKeys = new Set([manualKey("a1", "2025-01-02", "buy", 10, 100)]);
    const skipped = buildPlan(base({ trades: [trade({})], assets, manualKeys }));
    expect(skipped.rows[0].status).toBe("possible_duplicate");
    expect(skipped.lots).toHaveLength(0);
    const forced = buildPlan(base({ trades: [trade({})], assets, manualKeys, includeDuplicates: new Set(["zerodha_csv:t1"]) }));
    expect(forced.lots).toHaveLength(1);
  });
});

describe("buildPlan sells", () => {
  it("allocates a sell against buys in the same file regardless of row order", () => {
    const p = buildPlan(
      base({
        trades: [
          trade({ tradeId: "s", side: "sell", date: "2025-02-01", qty: 4, price: 130 }),
          trade({ tradeId: "b", qty: 10 }),
        ],
      }),
    );
    expect(p.sales).toHaveLength(1);
    expect(p.sales[0].allocations).toEqual([{ lotId: p.lots[0].id, qty: 4 }]);
  });

  it("rejects a sell that exceeds available quantity", () => {
    const p = buildPlan(base({ trades: [trade({ tradeId: "s", side: "sell", qty: 5 })] }));
    expect(p.sales).toHaveLength(0);
    expect(p.rows[0].status).toBe("error");
  });
});

describe("buildPlan estimated sync entries", () => {
  const assets = [{ id: "a1", name: "RELIANCE", type: "equity", isin: "INE002A01018" }];
  const lots = [
    { id: "L1", assetId: "a1", buyDate: "2025-06-01", qty: 10, unitPrice: 90, fees: 0, source: "kite_sync" },
  ];

  it("counts and removes unsold estimated lots when real trades arrive", () => {
    const off = buildPlan(base({ trades: [trade({})], assets, lots }));
    expect(off.estimatedCount).toBe(1);
    expect(off.removeLotIds).toEqual([]);
    const on = buildPlan(base({ trades: [trade({})], assets, lots, replaceEstimated: true }));
    expect(on.removeLotIds).toEqual(["L1"]);
  });
});
