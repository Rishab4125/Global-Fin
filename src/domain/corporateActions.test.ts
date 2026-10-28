import { describe, expect, it } from "vitest";
import {
  bonusShares,
  isWhole,
  quantityHeldBefore,
  unitsAt,
  unitsBefore,
  unitsNow,
  withUnits,
  type CorporateAction,
} from "./corporateActions";
import { computeHoldings, reallocate, type Lot } from "./fifo";
import { computeRealised, type SaleEvent } from "./gains";

const split = (id: string, date: string, ratioNew: number, ratioOld = 1, assetId = "a1"): CorporateAction => ({
  id,
  assetId,
  type: "split",
  date,
  ratioNew,
  ratioOld,
  amount: 0,
  tds: 0,
  note: "",
});

const lot = (id: string, buyDate: string, qty: number, unitPrice: number, extra: Partial<Lot> = {}): Lot => ({
  id,
  assetId: "a1",
  buyDate,
  qty,
  unitPrice,
  fees: 0,
  ...extra,
});

const sale = (p: Partial<SaleEvent> & Pick<SaleEvent, "date" | "qty" | "price" | "allocations">): SaleEvent => ({
  kind: "sale",
  id: "s1",
  assetId: "a1",
  assetName: "X",
  assetType: "equity",
  fees: 0,
  applyTax: true,
  exemptRedemption: false,
  ...p,
});

describe("units factor", () => {
  const actions = [split("s1", "2024-01-01", 5), split("s2", "2025-01-01", 2)];

  it("is 1 with no splits and for other holdings", () => {
    expect(unitsAt([], "a1", "2025-06-01")).toBe(1);
    expect(unitsAt(actions, "other", "2025-06-01")).toBe(1);
  });

  it("compounds splits on or before the date", () => {
    expect(unitsAt(actions, "a1", "2023-12-31")).toBe(1);
    expect(unitsAt(actions, "a1", "2024-01-01")).toBe(5);
    expect(unitsAt(actions, "a1", "2025-06-01")).toBe(10);
  });

  it("a purchase on the split date is already in post-split units", () => {
    expect(unitsAt(actions, "a1", "2024-01-01")).toBe(5);
    expect(unitsBefore(actions, "a1", "2024-01-01")).toBe(1);
  });

  it("ignores bonus and dividend events", () => {
    const other: CorporateAction[] = [{ ...split("b", "2024-01-01", 1), type: "bonus" }, { ...split("d", "2024-01-01", 1), type: "dividend" }];
    expect(unitsAt(other, "a1", "2025-01-01")).toBe(1);
  });
});

describe("PRD 4.3: a 1:5 split turns 10 shares at ₹1,000 into 50 at ₹200", () => {
  const actions = [split("s1", "2025-03-01", 5)];
  const lots = withUnits([lot("l1", "2024-01-15", 10, 1000)], actions);
  const h = computeHoldings(lots, new Map(), unitsNow(actions, "2025-06-01")).get("a1")!;

  it("multiplies quantity and divides unit cost", () => {
    expect(h.qty).toBe(50);
    expect(h.avgCost).toBe(200);
  });

  it("leaves total cost unchanged", () => {
    expect(h.cost).toBe(10000);
  });

  it("keeps the buy date", () => {
    expect(lots[0].buyDate).toBe("2024-01-15");
    expect(lots[0].qty).toBe(10);
  });

  it("includes purchase fees in unit cost without changing total cost", () => {
    const l = withUnits([lot("l1", "2024-01-15", 10, 1000, { fees: 50 })], actions);
    const x = computeHoldings(l, new Map(), unitsNow(actions, "2025-06-01")).get("a1")!;
    expect(x.cost).toBe(10050);
    expect(x.qty).toBe(50);
  });
});

describe("selling after a split", () => {
  const actions = [split("s1", "2025-03-01", 5)];
  const lots = withUnits([lot("l1", "2023-01-10", 10, 1000)], actions);

  it("matches post-split sale units to the original lot", () => {
    const { allocations, short } = reallocate(lots, [
      { id: "s", date: "2025-06-01", qty: 20, u: unitsAt(actions, "a1", "2025-06-01") },
    ]);
    expect(short).toBeNull();
    expect(allocations.get("s")).toEqual([{ lotId: "l1", qty: 4 }]); // 20 new shares = 4 original
  });

  it("computes gain from original cost and post-split price", () => {
    const u = unitsAt(actions, "a1", "2025-06-01");
    const s = sale({ date: "2025-06-01", qty: 50, price: 300, u, allocations: [{ lotId: "l1", qty: 10 }] });
    const [r] = computeRealised([s], lots, 0.3);
    expect(r.proceeds).toBe(15000);
    expect(r.cost).toBe(10000);
    expect(r.gain).toBe(5000);
    expect(r.ltcg).toBe(5000); // bought 2023, sold 2025: long term, buy date unchanged by the split
    expect(r.stcg).toBe(0);
  });

  it("holds the remainder in post-split units", () => {
    const sold = new Map([["l1", 4]]);
    const h = computeHoldings(lots, sold, unitsNow(actions, "2025-06-01")).get("a1")!;
    expect(h.qty).toBe(30);
    expect(h.cost).toBe(6000);
    expect(h.avgCost).toBe(200);
  });

  it("rejects a sale of more than the post-split quantity and says by how much", () => {
    const r = reallocate(lots, [{ id: "s", date: "2025-06-01", qty: 60, u: 5 }]);
    expect(r.short?.id).toBe("s");
    expect(r.shortBy).toBe(10);
  });

  it("a sale before the split stays in the old units", () => {
    const { allocations } = reallocate(lots, [{ id: "s", date: "2024-06-01", qty: 4, u: 1 }]);
    expect(allocations.get("s")).toEqual([{ lotId: "l1", qty: 4 }]);
    const sold = new Map([["l1", 4]]);
    const h = computeHoldings(lots, sold, unitsNow(actions, "2025-06-01")).get("a1")!;
    expect(h.qty).toBe(30); // 6 original shares left, now 30
    expect(h.cost).toBe(6000);
  });

  it("spans a lot bought before and one bought after the split", () => {
    const two = withUnits([lot("old", "2023-01-10", 10, 1000), lot("new", "2025-04-01", 20, 220)], actions);
    const { allocations } = reallocate(two, [{ id: "s", date: "2025-06-01", qty: 60, u: 5 }]);
    expect(allocations.get("s")).toEqual([
      { lotId: "old", qty: 10 }, // 50 post-split shares
      { lotId: "new", qty: 10 }, // the remaining 10, already post-split
    ]);
  });
});

describe("PRD 4.3: a 1:1 bonus doubles quantity, cost unchanged, holding period starts at the bonus date", () => {
  const original = lot("o", "2023-01-10", 10, 1000);
  const held = quantityHeldBefore([original], [], [], "a1", "2024-12-01");

  it("sizes the bonus from the shares held before the date", () => {
    expect(held).toBe(10);
    expect(bonusShares(held, 1, 1)).toBe(10);
    expect(bonusShares(10, 1, 2)).toBe(5);
    expect(bonusShares(5, 1, 2)).toBe(2); // fraction is settled in cash
    expect(bonusShares(1, 1, 3)).toBe(0);
  });

  const bonus = lot("b", "2024-12-01", 10, 0, { source: "bonus", eventId: "ev" });

  it("doubles the quantity and leaves total cost unchanged", () => {
    const h = computeHoldings([original, bonus], new Map()).get("a1")!;
    expect(h.qty).toBe(20);
    expect(h.cost).toBe(10000);
    expect(h.avgCost).toBe(500);
  });

  it("starts the bonus lot's holding period on the bonus date and counts the full proceeds as gain", () => {
    // Sold 8 months after the bonus: the original lot is long term, the bonus lot is not.
    const s = sale({ date: "2025-08-01", qty: 10, price: 1500, allocations: [{ lotId: "b", qty: 10 }] });
    const [r] = computeRealised([s], [original, bonus], 0.3);
    expect(r.gain).toBe(15000); // no cost
    expect(r.stcg).toBe(15000);
    expect(r.ltcg).toBe(0);
    const old = sale({ date: "2025-08-01", qty: 10, price: 1500, allocations: [{ lotId: "o", qty: 10 }] });
    const [o] = computeRealised([old], [original, bonus], 0.3);
    expect(o.ltcg).toBe(5000);
  });

  it("leaves the original shares' cost untouched when the bonus shares are sold", () => {
    const sold = new Map([["b", 10]]);
    const h = computeHoldings([original, bonus], sold).get("a1")!;
    expect(h.qty).toBe(10);
    expect(h.cost).toBe(10000);
    expect(h.avgCost).toBe(1000);
  });
});

describe("shares held before an event", () => {
  const lots = withUnits([lot("l1", "2023-01-01", 10, 100), lot("l2", "2024-06-01", 10, 100)], []);

  it("counts only lots bought before the day", () => {
    expect(quantityHeldBefore(lots, [], [], "a1", "2024-06-01")).toBe(10);
    expect(quantityHeldBefore(lots, [], [], "a1", "2024-06-02")).toBe(20);
  });

  it("subtracts sales made before the day, not on or after it", () => {
    const sales = [
      { date: "2024-03-01", allocations: [{ lotId: "l1", qty: 4 }] },
      { date: "2024-09-01", allocations: [{ lotId: "l1", qty: 3 }] },
    ];
    expect(quantityHeldBefore(lots, sales, [], "a1", "2024-07-01")).toBe(16);
    expect(quantityHeldBefore(lots, sales, [], "a1", "2024-12-01")).toBe(13);
  });

  it("expresses the quantity in the units in force before the event", () => {
    const actions = [split("s", "2024-01-01", 5)];
    const l = withUnits([lot("l1", "2023-01-01", 10, 100)], actions);
    expect(quantityHeldBefore(l, [], actions, "a1", "2024-09-01")).toBe(50);
    expect(quantityHeldBefore(l, [], actions, "a1", "2024-01-01")).toBe(10);
  });
});

describe("whole-share check", () => {
  it("accepts whole numbers and rejects fractions", () => {
    expect(isWhole(50)).toBe(true);
    expect(isWhole(10 / 3 * 3)).toBe(true);
    expect(isWhole(3.3333)).toBe(false);
  });
});

describe("PRD 4.3: a buyback of 100 shares with 60 accepted", () => {
  const lots = [lot("l1", "2023-01-01", 100, 400)];
  const accepted = 60;
  const s = sale({ date: "2025-06-01", qty: accepted, price: 1000, buyback: true, tenderedQty: 100, allocations: [{ lotId: "l1", qty: accepted }] });

  it("creates one sale of 60 and keeps 40 shares", () => {
    const rows = computeRealised([s], lots, 0.3);
    expect(rows).toHaveLength(1);
    expect(rows[0].qty).toBe(60);
    const h = computeHoldings(lots, new Map([["l1", accepted]])).get("a1")!;
    expect(h.qty).toBe(40);
    expect(h.cost).toBe(16000);
  });

  it("follows the date rule: dividend tax from 1 Oct 2024, none before", () => {
    const [after] = computeRealised([s], lots, 0.3);
    expect(after.tax).toBe(18720); // 60 * 1000 * 30% * 1.04
    const [before] = computeRealised([{ ...s, date: "2024-09-30" }], lots, 0.3);
    expect(before.tax).toBe(0);
  });
});
