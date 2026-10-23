import { describe, expect, it } from "vitest";
import { addMonths, financialYear, heldLongerThan } from "./dates";
import { allocateFifo, computeHoldings, type Lot } from "./fifo";
import { computeRealised, type MiscEvent, type SaleEvent } from "./gains";

const lot = (id: string, buyDate: string, qty: number, unitPrice: number, fees = 0): Lot => ({
  id,
  assetId: "a1",
  buyDate,
  qty,
  unitPrice,
  fees,
});

const sale = (
  p: Partial<SaleEvent> & Pick<SaleEvent, "date" | "qty" | "price" | "allocations">,
): SaleEvent => ({
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

describe("dates", () => {
  it("handles month ends and FY", () => {
    expect(addMonths("2024-01-31", 1)).toBe("2024-02-29");
    expect(financialYear("2025-03-31")).toBe("2024-25");
    expect(financialYear("2025-04-01")).toBe("2025-26");
  });
  it("long term needs strictly more than N months", () => {
    expect(heldLongerThan("2024-01-10", "2025-01-10", 12)).toBe(false);
    expect(heldLongerThan("2024-01-10", "2025-01-11", 12)).toBe(true);
  });
});

describe("fifo", () => {
  it("consumes oldest lots first and reports shortfall", () => {
    const lots = [lot("b", "2024-06-01", 10, 120), lot("a", "2024-01-01", 10, 100)];
    const rem = new Map([["a", 10], ["b", 10]]);
    const r = allocateFifo(lots, rem, 15, "2025-01-01");
    expect(r.allocations).toEqual([
      { lotId: "a", qty: 10 },
      { lotId: "b", qty: 5 },
    ]);
    expect(allocateFifo(lots, rem, 25, "2025-01-01").shortfall).toBe(5);
  });
  it("ignores lots bought after the sale date", () => {
    const lots = [lot("a", "2025-06-01", 10, 100)];
    expect(allocateFifo(lots, new Map([["a", 10]]), 5, "2025-01-01").shortfall).toBe(5);
  });
  it("computes holdings with average cost", () => {
    const h = computeHoldings([lot("a", "2024-01-01", 10, 100, 10)], new Map([["a", 4]]));
    expect(h.get("a1")!.qty).toBe(6);
    expect(h.get("a1")!.avgCost).toBeCloseTo(101);
  });
});

describe("realised gains and tax", () => {
  it("equity LTCG under the 1.25L exemption has no tax", () => {
    const lots = [lot("a", "2024-01-01", 100, 100)];
    const [r] = computeRealised(
      [sale({ date: "2025-02-01", qty: 40, price: 150, allocations: [{ lotId: "a", qty: 40 }] })],
      lots,
      0.3,
    );
    expect(r.ltcg).toBe(2000);
    expect(r.tax).toBe(0);
  });

  it("equity STCG is 20% plus cess", () => {
    const lots = [lot("a", "2025-01-01", 100, 100)];
    const [r] = computeRealised(
      [sale({ date: "2025-04-01", qty: 100, price: 150, allocations: [{ lotId: "a", qty: 100 }] })],
      lots,
      0.3,
    );
    expect(r.stcg).toBe(5000);
    expect(r.tax).toBe(1040);
  });

  it("equity LTCG above exemption is 12.5% + cess, exemption shared across FY sales", () => {
    const lots = [lot("a", "2023-01-01", 1000, 100)];
    const rows = computeRealised(
      [
        sale({ id: "s1", date: "2025-05-01", qty: 500, price: 400, allocations: [{ lotId: "a", qty: 500 }] }),
        sale({ id: "s2", date: "2025-06-01", qty: 100, price: 200, allocations: [{ lotId: "a", qty: 100 }] }),
      ],
      lots,
      0.3,
    );
    // s1 gain 150000 -> taxable 25000 -> 3125 * 1.04 = 3250
    expect(rows[0].tax).toBe(3250);
    // s2 gain 10000, exemption already used -> 1250 * 1.04 = 1300
    expect(rows[1].tax).toBe(1300);
  });

  it("applyTax=false records gain with zero tax", () => {
    const lots = [lot("a", "2025-01-01", 100, 100)];
    const [r] = computeRealised(
      [sale({ applyTax: false, date: "2025-04-01", qty: 100, price: 150, allocations: [{ lotId: "a", qty: 100 }] })],
      lots,
      0.3,
    );
    expect(r.gain).toBe(5000);
    expect(r.tax).toBe(0);
  });

  it("land held over 24 months is 12.5%, under is slab", () => {
    const lots = [lot("a", "2022-01-01", 1, 1000000)];
    const long = computeRealised(
      [sale({ assetType: "land", date: "2025-01-01", qty: 1, price: 2000000, allocations: [{ lotId: "a", qty: 1 }] })],
      lots,
      0.3,
    )[0];
    expect(long.tax).toBe(130000);
    const short = computeRealised(
      [sale({ assetType: "land", date: "2023-06-01", qty: 1, price: 2000000, allocations: [{ lotId: "a", qty: 1 }] })],
      lots,
      0.3,
    )[0];
    expect(short.tax).toBe(312000);
  });

  it("losses and crypto", () => {
    const lots = [lot("a", "2025-01-01", 1, 100000)];
    const loss = computeRealised(
      [sale({ assetType: "crypto", date: "2025-06-01", qty: 1, price: 80000, allocations: [{ lotId: "a", qty: 1 }] })],
      lots,
      0.3,
    )[0];
    expect(loss.gain).toBe(-20000);
    expect(loss.tax).toBe(0);
    const win = computeRealised(
      [sale({ assetType: "crypto", date: "2025-06-01", qty: 1, price: 150000, allocations: [{ lotId: "a", qty: 1 }] })],
      lots,
      0.3,
    )[0];
    expect(win.tax).toBe(15600);
  });

  it("SGB tax-free redemption and fees", () => {
    const lots = [lot("a", "2017-01-01", 10, 3000)];
    const [r] = computeRealised(
      [sale({ assetType: "sgb", exemptRedemption: true, date: "2025-01-01", qty: 10, price: 7000, fees: 100, allocations: [{ lotId: "a", qty: 10 }] })],
      lots,
      0.3,
    );
    expect(r.gain).toBe(39900);
    expect(r.tax).toBe(0);
  });

  it("misc entries: tax adjusted = none, otherwise rule applied", () => {
    const misc = (p: Partial<MiscEvent>): MiscEvent => ({
      kind: "misc",
      id: "m",
      assetType: "fd",
      date: "2025-06-01",
      amount: 10000,
      taxAdjusted: false,
      term: "STCG",
      entryType: "general",
      cost: 0,
      brokerage: 0,
      note: "",
      ...p,
    });
    const [a, b, c] = computeRealised(
      [misc({ id: "a" }), misc({ id: "b", taxAdjusted: true }), misc({ id: "c", amount: -500 })],
      [],
      0.3,
    );
    expect(a.tax).toBe(3120);
    expect(b.tax).toBe(0);
    expect(c.tax).toBe(0);
    expect(c.gain).toBe(-500);
  });
});

describe("misc brokerage and buyback", () => {
  const misc = (p: Partial<MiscEvent>): MiscEvent => ({
    kind: "misc",
    id: "m",
    assetType: "equity",
    date: "2025-06-01",
    amount: 10000,
    taxAdjusted: false,
    term: "STCG",
    entryType: "general",
    cost: 0,
    brokerage: 0,
    note: "",
    ...p,
  });

  it("brokerage reduces a profit before tax", () => {
    const [r] = computeRealised([misc({ amount: 10000, brokerage: 500 })], [], 0.3);
    expect(r.gain).toBe(9500);
    expect(r.tax).toBe(1976); // 9500 * 20% * 1.04
  });

  it("brokerage deepens a loss and no tax is charged", () => {
    const [r] = computeRealised([misc({ amount: -2000, brokerage: 100 })], [], 0.3);
    expect(r.gain).toBe(-2100);
    expect(r.tax).toBe(0);
  });

  it("buyback after 1 Oct 2024 is taxed as dividend at slab rate on full proceeds", () => {
    const [r] = computeRealised(
      [misc({ entryType: "buyback", amount: 100000, cost: 40000, brokerage: 200 })],
      [],
      0.3,
    );
    expect(r.gain).toBe(59800); // proceeds - cost - brokerage
    expect(r.tax).toBe(31200); // 100000 * 30% * 1.04
    expect(r.proceeds).toBe(100000);
    expect(r.cost).toBe(40000);
  });

  it("buyback before 1 Oct 2024 is tax-free for the shareholder", () => {
    const [r] = computeRealised(
      [misc({ entryType: "buyback", date: "2024-09-15", amount: 100000, cost: 40000 })],
      [],
      0.3,
    );
    expect(r.gain).toBe(60000);
    expect(r.tax).toBe(0);
  });

  it("buyback marked tax adjusted has no tax", () => {
    const [r] = computeRealised(
      [misc({ entryType: "buyback", amount: 100000, cost: 40000, taxAdjusted: true })],
      [],
      0.3,
    );
    expect(r.tax).toBe(0);
  });
});
