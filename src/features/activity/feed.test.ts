import { describe, expect, it } from "vitest";
import type { CorporateAction } from "../../domain/corporateActions";
import { buildFeed, groupByMonth, monthLabel, type FeedInput } from "./feed";

const action = (over: Partial<CorporateAction>): CorporateAction => ({
  id: "a1", assetId: "x", type: "split", date: "2025-05-10", ratioNew: 5, ratioOld: 1, amount: 0, tds: 0, note: "", ...over,
});

const input: FeedInput = {
  assets: [{ id: "x", name: "ITC", type: "equity" }],
  lots: [
    { id: "l1", assetId: "x", buyDate: "2025-04-02", qty: 10, unitPrice: 100, fees: 5, platform: "Zerodha" },
    { id: "l2", assetId: "x", buyDate: "2025-05-10", qty: 40, unitPrice: 0, fees: 0, platform: "Zerodha", eventId: "a1" },
  ],
  sales: [{ id: "s1", assetId: "x", date: "2025-05-20", qty: 5, price: 120, fees: 3, platforms: ["Zerodha"] }],
  misc: [{ id: "m1", assetType: "equity", date: "2025-05-22", amount: -200, brokerage: 10, note: "F&O" }],
  actions: [action({}), action({ id: "a2", type: "dividend", date: "2025-06-01", amount: 50 })],
};

describe("buildFeed", () => {
  const feed = buildFeed(input);

  it("lists buys, sales, misc, dividends and events, newest first", () => {
    expect(feed.map((f) => f.kind)).toEqual(["dividend", "misc", "sell", "event", "buy"]);
    expect(feed.map((f) => f.date)).toEqual(["2025-06-01", "2025-05-22", "2025-05-20", "2025-05-10", "2025-04-02"]);
  });

  it("leaves the bonus lot out because its event already shows", () => {
    expect(feed.filter((f) => f.kind === "buy")).toHaveLength(1);
  });

  it("works out cash after fees", () => {
    const by = Object.fromEntries(feed.map((f) => [f.kind, f]));
    expect(by.buy.cash).toBe(-1005);
    expect(by.sell.cash).toBe(597);
    expect(by.misc.cash).toBe(-210);
    expect(by.dividend.cash).toBe(50);
    expect(by.event.cash).toBe(0);
    expect(by.event.detail).toBe("1:5 split");
  });

  it("marks a buyback as its own kind", () => {
    const f = buildFeed({ ...input, sales: [{ ...input.sales[0], buyback: true }] });
    expect(f.some((x) => x.kind === "buyback")).toBe(true);
  });
});

describe("groupByMonth", () => {
  it("gives each month its count and net cash flow", () => {
    const g = groupByMonth(buildFeed(input));
    expect(g.map((m) => [m.key, m.count, m.net])).toEqual([
      ["2025-06", 1, 50],
      ["2025-05", 3, 387],
      ["2025-04", 1, -1005],
    ]);
    expect(g[1].label).toBe("May 2025");
  });

  it("names months", () => {
    expect(monthLabel("2026-01")).toBe("January 2026");
  });
});
