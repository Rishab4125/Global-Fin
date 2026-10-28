import { describe, expect, it } from "vitest";
import {
  buildHoldingRows,
  filterOptions,
  groupHoldingRows,
  searchRows,
  sortHoldingRows,
  type ListAsset,
  type ListLot,
} from "./list";

const asset = (id: string, type: ListAsset["type"], name: string, tags: string[] = []): ListAsset => ({ id, type, name, tags });
const assets = new Map<string, ListAsset>([
  ["rel", asset("rel", "equity", "RELIANCE", ["Core"])],
  ["hdfc", asset("hdfc", "equity", "HDFCBANK", ["Core", "Retirement"])],
  ["gold", asset("gold", "gold_etf", "GOLDBEES")],
  ["coin", asset("coin", "gold_physical", "Gold coin")],
  ["fd", asset("fd", "fd", "HDFC FD", ["Retirement"])],
]);

const lot = (id: string, assetId: string, qty: number, unitPrice: number, platform: string, buyDate = "2024-01-01", fees = 0, u = 1): ListLot => ({
  id,
  assetId,
  qty,
  unitPrice,
  fees,
  platform,
  buyDate,
  u,
});

const lots = [
  lot("l1", "rel", 100, 2000, "Zerodha", "2023-02-10"),
  lot("l2", "hdfc", 50, 1500, "Zerodha", "2024-05-14"),
  lot("l3", "hdfc", 30, 1600, "Groww", "2025-03-12", 20),
  lot("l4", "gold", 500, 60, "Zerodha", "2025-01-20"),
  lot("l5", "coin", 10, 6000, "Self / locker", "2024-11-02"),
  lot("l6", "fd", 1, 500000, "HDFC Bank", "2025-04-01"),
];
const none = new Map<string, number>();
const build = (f = {}, sold = none, now = new Map<string, number>()) => buildHoldingRows(lots, sold, assets, now, f);

describe("buildHoldingRows", () => {
  const { rows, portfolioTotal } = build();
  const by = Object.fromEntries(rows.map((r) => [r.name, r]));

  it("has one row per holding with the cost of what is left", () => {
    expect(rows).toHaveLength(5);
    expect(by.RELIANCE.cost).toBe(200000);
    expect(by.HDFCBANK.cost).toBe(75000 + 48020);
    expect(portfolioTotal).toBe(200000 + 123020 + 30000 + 60000 + 500000);
  });

  it("shows every platform a holding is on, with the part held on each", () => {
    expect(by.HDFCBANK.platforms).toEqual(["Groww", "Zerodha"]);
    expect(by.HDFCBANK.byPlatform.map((p) => [p.platform, p.cost])).toEqual([
      ["Zerodha", 75000],
      ["Groww", 48020],
    ]);
    expect(by.HDFCBANK.qty).toBe(80);
  });

  it("includes fees in cost and divides by quantity for the average", () => {
    expect(by.HDFCBANK.avgCost).toBeCloseTo(123020 / 80, 8);
  });

  it("reports the latest purchase date", () => {
    expect(by.HDFCBANK.lastBuy).toBe("2025-03-12");
  });

  it("counts what remains after a sale and drops a fully sold holding", () => {
    const part = build({}, new Map([["l1", 40]]));
    expect(part.rows.find((r) => r.id === "rel")!.qty).toBe(60);
    expect(part.rows.find((r) => r.id === "rel")!.cost).toBe(120000);
    const all = build({}, new Map([["l1", 100]]));
    expect(all.rows.find((r) => r.id === "rel")).toBeUndefined();
  });

  it("shows quantity in today's units after a split but keeps the cost", () => {
    const now = new Map([["rel", 5]]);
    const split = buildHoldingRows([lot("l1", "rel", 10, 1000, "Zerodha", "2023-01-01", 0, 1)], none, assets, now);
    expect(split.rows[0].qty).toBe(50);
    expect(split.rows[0].cost).toBe(10000);
    expect(split.rows[0].avgCost).toBe(200);
  });

  it("does not rescale a lot bought after the split", () => {
    const now = new Map([["rel", 5]]);
    const r = buildHoldingRows([lot("l1", "rel", 20, 220, "Zerodha", "2025-04-01", 0, 5)], none, assets, now);
    expect(r.rows[0].qty).toBe(20);
  });
});

describe("filters", () => {
  it("filters by category", () => {
    expect(build({ category: ["Metals"] }).rows.map((r) => r.name)).toEqual(["Gold coin"]);
  });

  it("filters by platform and shows only the part held there", () => {
    const r = build({ platform: ["Groww"] }).rows;
    expect(r.map((x) => x.name)).toEqual(["HDFCBANK"]);
    expect(r[0].cost).toBe(48020);
    expect(r[0].qty).toBe(30);
  });

  it("filters by exposure, so the commodity ETF counts as gold", () => {
    expect(build({ exposure: ["Gold"] }).rows.map((r) => r.name).sort()).toEqual(["GOLDBEES", "Gold coin"]);
  });

  it("filters by tag", () => {
    expect(build({ tag: ["Retirement"] }).rows.map((r) => r.name).sort()).toEqual(["HDFC FD", "HDFCBANK"]);
  });

  it("combines filters and leaves the portfolio total alone", () => {
    const r = build({ category: ["Stocks & ETFs"], platform: ["Zerodha"], tag: ["Core"] });
    expect(r.rows.map((x) => x.name).sort()).toEqual(["HDFCBANK", "RELIANCE"]);
    expect(r.portfolioTotal).toBe(913020);
  });

  it("returns nothing when no holding matches", () => {
    expect(build({ tag: ["Nope"] }).rows).toEqual([]);
  });

  it("offers the categories, exposures and tags present", () => {
    const o = filterOptions([...assets.values()]);
    expect(o.categories).toEqual(["Fixed Deposits", "Metals", "Stocks & ETFs"]);
    expect(o.exposures).toEqual(["Debt", "Equity", "Gold"]);
    expect(o.tags).toEqual(["Core", "Retirement"]);
  });
});

describe("searchRows", () => {
  const { rows } = build();
  it("matches name, category, platform and tag, ignoring case", () => {
    expect(searchRows(rows, "reli").map((r) => r.name)).toEqual(["RELIANCE"]);
    expect(searchRows(rows, "metals").map((r) => r.name)).toEqual(["Gold coin"]);
    expect(searchRows(rows, "groww").map((r) => r.name)).toEqual(["HDFCBANK"]);
    expect(searchRows(rows, "RETIREMENT").map((r) => r.name).sort()).toEqual(["HDFC FD", "HDFCBANK"]);
  });
  it("matches the sub-type", () => {
    expect(searchRows(rows, "commodity").map((r) => r.name)).toEqual(["GOLDBEES"]);
  });
  it("keeps everything for an empty search", () => {
    expect(searchRows(rows, "  ")).toHaveLength(5);
  });
});

describe("sortHoldingRows", () => {
  const { rows } = build();
  const names = (r: typeof rows) => r.map((x) => x.name);

  it("sorts by invested, both ways", () => {
    expect(names(sortHoldingRows(rows, "invested", "desc"))[0]).toBe("HDFC FD");
    expect(names(sortHoldingRows(rows, "invested", "asc"))[0]).toBe("GOLDBEES");
  });
  it("sorts by name A to Z", () => {
    expect(names(sortHoldingRows(rows, "name", "asc"))).toEqual(["Gold coin", "GOLDBEES", "HDFC FD", "HDFCBANK", "RELIANCE"]);
  });
  it("sorts by quantity and by recently bought", () => {
    expect(names(sortHoldingRows(rows, "qty", "desc"))[0]).toBe("GOLDBEES");
    expect(names(sortHoldingRows(rows, "recent", "desc"))[0]).toBe("HDFC FD");
  });
});

describe("groupHoldingRows", () => {
  const { rows, portfolioTotal } = build();

  it("returns one list when not grouping", () => {
    const g = groupHoldingRows(rows, "none");
    expect(g).toHaveLength(1);
    expect(g[0].cost).toBe(portfolioTotal);
  });

  it("groups by category with a subtotal, largest first", () => {
    const g = groupHoldingRows(rows, "category");
    expect(g.map((x) => [x.key, x.cost])).toEqual([
      ["Fixed Deposits", 500000],
      ["Stocks & ETFs", 200000 + 123020 + 30000],
      ["Metals", 60000],
    ]);
    expect(g.reduce((s, x) => s + x.cost, 0)).toBe(portfolioTotal);
  });

  it("groups by platform, putting a two-platform holding in both with its own part", () => {
    const g = groupHoldingRows(rows, "platform");
    const zerodha = g.find((x) => x.key === "Zerodha")!;
    const groww = g.find((x) => x.key === "Groww")!;
    expect(zerodha.rows.find((r) => r.name === "HDFCBANK")!.cost).toBe(75000);
    expect(groww.rows.find((r) => r.name === "HDFCBANK")!.cost).toBe(48020);
    expect(g.reduce((s, x) => s + x.cost, 0)).toBe(portfolioTotal);
  });

  it("keeps the sort order inside each group", () => {
    const sorted = sortHoldingRows(rows, "name", "asc");
    const stocks = groupHoldingRows(sorted, "category").find((x) => x.key === "Stocks & ETFs")!;
    expect(stocks.rows.map((r) => r.name)).toEqual(["GOLDBEES", "HDFCBANK", "RELIANCE"]);
  });
});
