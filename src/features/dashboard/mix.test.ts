import { describe, expect, it } from "vitest";
import { computeMix, rowsFor, upcomingMaturities, type MixAsset, type MixLot } from "./mix";

const assets = new Map<string, MixAsset>([
  ["rel", { id: "rel", type: "equity", name: "RELIANCE" }],
  ["hdfc", { id: "hdfc", type: "equity", name: "HDFCBANK" }],
  ["gold", { id: "gold", type: "gold_etf", name: "GOLDBEES" }],
  ["coin", { id: "coin", type: "gold_physical", name: "Gold coin" }],
  ["fd", { id: "fd", type: "fd", name: "HDFC FD", details: { maturity: "2026-12-01" } }],
]);

const lot = (id: string, assetId: string, qty: number, unitPrice: number, platform: string, fees = 0): MixLot => ({
  id,
  assetId,
  qty,
  unitPrice,
  fees,
  platform,
});

const lots = [
  lot("l1", "rel", 100, 2000, "Zerodha"),
  lot("l2", "hdfc", 50, 1500, "Zerodha"),
  lot("l3", "hdfc", 30, 1600, "Groww", 20),
  lot("l4", "gold", 500, 60, "Zerodha"),
  lot("l5", "coin", 10, 6000, "Self / locker"),
  lot("l6", "fd", 1, 500000, "HDFC Bank"),
];

describe("computeMix", () => {
  const mix = computeMix(lots, new Map(), assets);

  it("totals the cost of everything held", () => {
    expect(mix.total).toBe(200000 + 75000 + 48020 + 30000 + 60000 + 500000);
  });

  it("gives the same total in every view", () => {
    for (const rows of [mix.byPlatform, mix.byCategory, mix.byExposure]) {
      expect(rows.reduce((s, r) => s + r.cost, 0)).toBeCloseTo(mix.total, 2);
      expect(rows.reduce((s, r) => s + r.share, 0)).toBeCloseTo(100, 6);
    }
  });

  it("splits a holding on two platforms by lot", () => {
    const by = Object.fromEntries(mix.byPlatform.map((r) => [r.key, r.cost]));
    expect(by.Zerodha).toBe(200000 + 75000 + 30000);
    expect(by.Groww).toBe(48020);
    expect(by["HDFC Bank"]).toBe(500000);
  });

  it("groups by the new categories and by exposure", () => {
    const cat = Object.fromEntries(mix.byCategory.map((r) => [r.key, r.cost]));
    expect(cat["Stocks & ETFs"]).toBe(200000 + 75000 + 48020 + 30000);
    expect(cat.Metals).toBe(60000);
    expect(cat["Fixed Deposits"]).toBe(500000);
    const exp = Object.fromEntries(mix.byExposure.map((r) => [r.key, r.cost]));
    // Commodity ETF sits in Stocks & ETFs but counts as Gold, so "how much gold in total" includes it.
    expect(exp.Gold).toBe(30000 + 60000);
    expect(exp.Equity).toBe(200000 + 75000 + 48020);
    expect(exp.Debt).toBe(500000);
  });

  it("sorts largest first and reports shares", () => {
    expect(mix.byPlatform[0].key).toBe("HDFC Bank");
    expect(mix.byPlatform[0].share).toBeCloseTo((500000 / mix.total) * 100, 6);
    expect(rowsFor(mix, "Category")).toBe(mix.byCategory);
  });

  it("counts only what is left after sales, at the cost of the remaining units", () => {
    const m = computeMix(lots, new Map([["l1", 40]]), assets);
    expect(m.byHolding.find((h) => h.id === "rel")!.cost).toBe(60 * 2000);
  });

  it("drops a holding that is fully sold", () => {
    const m = computeMix(lots, new Map([["l1", 100]]), assets);
    expect(m.holdingIds).not.toContain("rel");
    expect(m.total).toBe(mix.total - 200000);
  });

  it("includes purchase fees in cost", () => {
    const m = computeMix([lot("x", "rel", 10, 100, "Zerodha", 50)], new Map(), assets);
    expect(m.total).toBe(1050);
  });

  it("applies category and platform filters to every view", () => {
    const m = computeMix(lots, new Map(), assets, { category: ["Stocks & ETFs"], platform: ["Zerodha"] });
    expect(m.total).toBe(200000 + 75000 + 30000);
    expect(m.byPlatform.map((r) => r.key)).toEqual(["Zerodha"]);
    expect(m.byCategory.map((r) => r.key)).toEqual(["Stocks & ETFs"]);
  });

  it("rounds each lot once, so the headline equals the sum of its rows", () => {
    const odd = [lot("a", "rel", 3, 33.3333, "Zerodha"), lot("b", "hdfc", 3, 33.3333, "Groww")];
    const m = computeMix(odd, new Map(), assets);
    expect(m.total).toBe(m.byPlatform.reduce((s, r) => s + r.cost, 0));
  });

  it("copes with nothing held", () => {
    const m = computeMix([], new Map(), assets);
    expect(m.total).toBe(0);
    expect(m.byPlatform).toEqual([]);
  });

  it("ignores lots of unknown holdings", () => {
    expect(computeMix([lot("z", "ghost", 1, 100, "Zerodha")], new Map(), assets).total).toBe(0);
  });
});

describe("upcomingMaturities", () => {
  const list = [...assets.values()];
  const held = new Set(["fd", "rel"]);

  it("lists a held deposit maturing within 90 days with the days left", () => {
    const r = upcomingMaturities(list, held, "2026-10-28");
    expect(r).toEqual([{ id: "fd", name: "HDFC FD", date: "2026-12-01", daysLeft: 34 }]);
  });

  it("leaves out maturities further away, already past, or on something not held", () => {
    expect(upcomingMaturities(list, held, "2026-06-01")).toEqual([]);
    expect(upcomingMaturities(list, held, "2027-01-01")).toEqual([]);
    expect(upcomingMaturities(list, new Set(["rel"]), "2026-10-28")).toEqual([]);
  });

  it("includes a maturity today and exactly 90 days away", () => {
    const a: MixAsset[] = [
      { id: "a", type: "fd", name: "A", details: { maturity: "2026-10-28" } },
      { id: "b", type: "fd", name: "B", details: { maturity: "2027-01-26" } },
      { id: "c", type: "fd", name: "C", details: { maturity: "2027-01-27" } },
    ];
    const r = upcomingMaturities(a, new Set(["a", "b", "c"]), "2026-10-28");
    expect(r.map((x) => [x.id, x.daysLeft])).toEqual([["a", 0], ["b", 90]]);
  });

  it("sorts soonest first and ignores a missing or malformed date", () => {
    const a: MixAsset[] = [
      { id: "a", type: "fd", name: "Later", details: { maturity: "2026-12-20" } },
      { id: "b", type: "fd", name: "Sooner", details: { maturity: "2026-11-05" } },
      { id: "c", type: "fd", name: "Bad", details: { maturity: "soon" } },
      { id: "d", type: "fd", name: "None" },
    ];
    expect(upcomingMaturities(a, new Set(["a", "b", "c", "d"]), "2026-10-28").map((x) => x.name)).toEqual(["Sooner", "Later"]);
  });
});
