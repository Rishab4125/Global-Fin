import { describe, expect, it } from "vitest";
import { addMonths, financialYear, heldLongerThan } from "./dates";
import { allocateFifo, computeHoldings, reallocate, type Lot } from "./fifo";
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
      brokerage: 0,
      note: "",
      ...p,
    });
    const [a, b, c] = computeRealised(
      [misc({ id: "a" }), misc({ id: "b", taxAdjusted: true }), misc({ id: "c", amount: -500 })],
      [],
      0.3,
    );
    // The 500 loss in the same FY reduces the 10000 profit: 9500 * 30% * 1.04
    expect(a.tax).toBe(2964);
    expect(b.tax).toBe(0);
    expect(c.tax).toBe(0);
    expect(c.gain).toBe(-500);
    expect(c.lossUsed).toBe(500);
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

  it("dividend income is taxed at slab rate, shown per stock, and not touched by brokerage", () => {
    const [r] = computeRealised(
      [misc({ entryType: "dividend", assetName: "RELIANCE", amount: 3600 })],
      [],
      0.3,
    );
    expect(r.label).toBe("Dividend: RELIANCE");
    expect(r.income).toBe(3600);
    expect(r.gain).toBe(3600);
    expect(r.stcg + r.ltcg).toBe(0);
    expect(r.tax).toBe(1123.2); // 3600 * 30% * 1.04, not the 20% equity STCG rate
  });

  it("dividend is not reduced by capital losses", () => {
    const lots = [lot("a", "2025-01-01", 100, 100)];
    const rows = computeRealised(
      [
        sale({ id: "loss", date: "2025-07-01", qty: 100, price: 50, allocations: [{ lotId: "a", qty: 100 }] }),
        misc({ id: "div", entryType: "dividend", assetName: "X", amount: 1000 }),
      ],
      lots,
      0.3,
    );
    expect(rows.find((r) => r.id === "div")!.tax).toBe(312);
  });

  it("dividends add up in the period total", () => {
    const rows = computeRealised(
      [
        misc({ id: "d1", entryType: "dividend", assetName: "A", amount: 3600 }),
        misc({ id: "d2", entryType: "dividend", assetName: "B", amount: 5200, date: "2025-08-01" }),
      ],
      [],
      0.3,
    );
    expect(rows.reduce((s, r) => s + r.income, 0)).toBe(8800);
  });

  it("dividend marked tax adjusted has no tax", () => {
    const [r] = computeRealised([misc({ entryType: "dividend", assetName: "A", amount: 1000, taxAdjusted: true })], [], 0.3);
    expect(r.tax).toBe(0);
  });
});

describe("share buyback (a sale flagged as a buyback)", () => {
  const lots = [lot("a", "2024-01-01", 100, 400)];
  const bb = (p: Partial<SaleEvent>) =>
    sale({ buyback: true, date: "2025-06-01", qty: 60, price: 1000, allocations: [{ lotId: "a", qty: 60 }], ...p });

  it("after 1 Oct 2024 is taxed as dividend at slab rate on full proceeds, cost is a loss", () => {
    const [r] = computeRealised([bb({ date: "2025-06-01", fees: 200 })], lots, 0.3);
    expect(r.proceeds).toBe(59800);
    expect(r.cost).toBe(24000);
    expect(r.gain).toBe(35800);
    expect(r.tax).toBe(18720); // 60 * 1000 * 30% * 1.04, on the full proceeds before fees
  });

  it("before 1 Oct 2024 is tax-free for the shareholder", () => {
    const [r] = computeRealised([bb({ date: "2024-09-15" })], lots, 0.3);
    expect(r.gain).toBe(36000);
    expect(r.tax).toBe(0);
  });

  it("marked tax not applied has no tax", () => {
    const [r] = computeRealised([bb({ date: "2025-06-01", applyTax: false })], lots, 0.3);
    expect(r.tax).toBe(0);
  });

  it("notes how many of the tendered shares were accepted", () => {
    const [r] = computeRealised([bb({ date: "2025-06-01", tenderedQty: 100 })], lots, 0.3);
    expect(r.note).toContain("60 of 100");
  });
});

describe("loss set-off within a financial year", () => {
  const L = (id: string, buyDate: string, qty: number, unitPrice: number): Lot => lot(id, buyDate, qty, unitPrice);
  const S = (id: string, lotId: string, date: string, qty: number, price: number, extra: Partial<SaleEvent> = {}) =>
    sale({ id, date, qty, price, allocations: [{ lotId, qty }], ...extra });
  const byId = (rows: ReturnType<typeof computeRealised>, id: string) => rows.find((r) => r.id === id)!;

  it("a loss reduces the taxable gain and shows the tax it saved", () => {
    const lots = [L("a", "2025-01-01", 100, 100), L("b", "2025-01-01", 100, 100)];
    const rows = computeRealised(
      [S("gain", "a", "2025-06-01", 100, 150), S("loss", "b", "2025-07-01", 100, 80)],
      lots,
      0.3,
    );
    // gain 5000 - loss 2000 = 3000 taxable at 20% + cess
    expect(byId(rows, "gain").tax).toBe(624);
    expect(byId(rows, "gain").offsetByLosses).toBe(2000);
    expect(byId(rows, "loss").lossUsed).toBe(2000);
    expect(byId(rows, "loss").taxSaved).toBe(416);
    expect(byId(rows, "loss").tax).toBe(0);
  });

  it("the order of the sales within the year does not matter", () => {
    const lots = [L("a", "2025-01-01", 100, 100), L("b", "2025-01-01", 100, 100)];
    const rows = computeRealised(
      [S("loss", "b", "2025-05-01", 100, 80), S("gain", "a", "2025-09-01", 100, 150)],
      lots,
      0.3,
    );
    expect(byId(rows, "gain").tax).toBe(624);
  });

  it("the 1.25L exemption applies after losses, not before", () => {
    const lots = [L("a", "2023-01-01", 1000, 100), L("b", "2025-05-01", 100, 1000)];
    const rows = computeRealised(
      [S("gain", "a", "2025-06-01", 1000, 300), S("loss", "b", "2025-06-10", 100, 0)],
      lots,
      0.3,
    );
    // LTCG 200000 less short-term loss 100000 = 100000, inside the 125000 exemption
    expect(byId(rows, "gain").tax).toBe(0);
    expect(byId(rows, "gain").exemptionUsed).toBe(100000);
    // without the loss: (200000 - 125000) * 12.5% * 1.04
    expect(byId(rows, "loss").taxSaved).toBe(9750);
  });

  it("a long-term loss cannot reduce a short-term gain", () => {
    const lots = [L("lt", "2023-01-01", 100, 100), L("st", "2025-01-01", 100, 100)];
    const rows = computeRealised(
      [S("gain", "st", "2025-06-01", 100, 150), S("loss", "lt", "2025-06-02", 100, 50)],
      lots,
      0.3,
    );
    expect(byId(rows, "gain").tax).toBe(1040);
    expect(byId(rows, "loss").lossUsed).toBe(0);
  });

  it("a short-term loss can reduce a long-term gain", () => {
    const lots = [L("lt", "2023-01-01", 1000, 100), L("st", "2025-05-01", 100, 1000)];
    const rows = computeRealised(
      [S("gain", "lt", "2025-06-01", 1000, 400), S("loss", "st", "2025-06-02", 100, 0)],
      lots,
      0.3,
    );
    // LTCG 300000 - 100000 = 200000; exemption 125000; taxable 75000
    expect(byId(rows, "gain").tax).toBe(9750);
  });

  it("losses do not carry across financial years", () => {
    const lots = [L("a", "2025-01-01", 100, 100), L("b", "2025-01-01", 100, 100)];
    const rows = computeRealised(
      [S("loss", "b", "2025-02-01", 100, 80), S("gain", "a", "2025-06-01", 100, 150)],
      lots,
      0.3,
    );
    expect(byId(rows, "gain").tax).toBe(1040);
    expect(byId(rows, "loss").lossUsed).toBe(0);
  });

  it("crypto losses and sales with the tax effect off take no part", () => {
    const lots = [L("a", "2025-01-01", 100, 100), L("c", "2025-01-01", 1, 100000), L("d", "2025-01-01", 100, 100)];
    const rows = computeRealised(
      [
        S("gain", "a", "2025-06-01", 100, 150),
        S("crypto", "c", "2025-06-02", 1, 50000, { assetType: "crypto" }),
        S("off", "d", "2025-06-03", 100, 50, { applyTax: false }),
      ],
      lots,
      0.3,
    );
    expect(byId(rows, "gain").tax).toBe(1040);
    expect(byId(rows, "crypto").lossUsed).toBe(0);
    expect(byId(rows, "off").lossUsed).toBe(0);
  });

  it("applies the loss to the highest-taxed gain first", () => {
    const lots = [L("land", "2025-01-01", 1, 100000), L("eq", "2025-01-01", 100, 100), L("l", "2025-01-01", 10, 100)];
    const rows = computeRealised(
      [
        S("landGain", "land", "2025-06-01", 1, 110000, { assetType: "land" }),
        S("eqGain", "eq", "2025-06-02", 100, 200),
        S("loss", "l", "2025-06-03", 10, 0),
      ],
      lots,
      0.3,
    );
    // loss 1000 reduces the slab-rate (30%) land gain, not the 20% equity gain
    expect(byId(rows, "landGain").tax).toBe(2808);
    expect(byId(rows, "eqGain").tax).toBe(2080);
  });
});

describe("selling a holding in a share buyback", () => {
  const lots = [lot("a", "2025-01-01", 100, 400), lot("g", "2025-01-01", 100, 100)];
  const buyback = (extra: Partial<SaleEvent> = {}) =>
    sale({ id: "bb", buyback: true, date: "2025-06-01", qty: 100, price: 1000, allocations: [{ lotId: "a", qty: 100 }], ...extra });

  it("taxes the full proceeds as dividend at the slab rate", () => {
    const [r] = computeRealised([buyback()], lots, 0.3);
    expect(r.buyback).toBe(true);
    expect(r.gain).toBe(60000); // proceeds - cost
    expect(r.tax).toBe(31200); // 100000 * 30% * 1.04
    expect(r.taxableGain).toBe(100000);
  });

  it("its cost is a capital loss that reduces other gains in the same year", () => {
    const rows = computeRealised(
      [
        buyback(),
        sale({ id: "gain", date: "2025-06-02", qty: 100, price: 150, allocations: [{ lotId: "g", qty: 100 }] }),
      ],
      lots,
      0.3,
    );
    const gain = rows.find((r) => r.id === "gain")!;
    const bb = rows.find((r) => r.id === "bb")!;
    expect(gain.tax).toBe(0); // 5000 short-term gain wiped out by the 40000 loss
    expect(bb.lossUsed).toBe(5000);
    expect(bb.taxSaved).toBe(1040);
    expect(bb.tax).toBe(31200);
  });

  it("is tax-free for the shareholder before 1 Oct 2024 and creates no loss", () => {
    const rows = computeRealised(
      [
        buyback({ date: "2024-09-15" }),
        sale({ id: "gain", date: "2024-09-16", qty: 100, price: 150, allocations: [{ lotId: "g", qty: 100 }] }),
      ],
      [lot("a", "2024-01-01", 100, 400), lot("g", "2024-01-01", 100, 100)],
      0.3,
    );
    expect(rows.find((r) => r.id === "bb")!.tax).toBe(0);
    expect(rows.find((r) => r.id === "gain")!.tax).toBe(1040); // 5000 * 20% * 1.04, taxed in full: the buyback creates no loss
  });

  it("does nothing special when tax effect is off", () => {
    const [r] = computeRealised([buyback({ applyTax: false })], lots, 0.3);
    expect(r.tax).toBe(0);
  });
});

describe("fixes", () => {
  it("uses the full-year 1.25L exemption for a sale before the July 2024 change", () => {
    const lots = [lot("a", "2022-01-01", 1000, 100)];
    // gain 120000 on 2024-06-01: inside 1.25L (the cap in force at the end of FY 2024-25), so no tax
    const [r] = computeRealised(
      [sale({ date: "2024-06-01", qty: 100, price: 1300, allocations: [{ lotId: "a", qty: 100 }] })],
      lots,
      0.3,
    );
    expect(r.ltcg).toBe(120000);
    expect(r.tax).toBe(0);
  });

  it("does not deduct sale fees for crypto", () => {
    const lots = [lot("a", "2025-01-01", 1, 1000)];
    const [r] = computeRealised(
      [sale({ assetType: "crypto", fees: 50, date: "2025-03-01", qty: 1, price: 2000, allocations: [{ lotId: "a", qty: 1 }] })],
      lots,
      0.3,
    );
    expect(r.gain).toBe(1000);
  });

  it("ignores the SGB tax-free flag on other asset types", () => {
    const lots = [lot("a", "2024-01-01", 10, 100)];
    const [r] = computeRealised(
      [sale({ assetType: "gold_etf", exemptRedemption: true, date: "2025-03-01", qty: 10, price: 200, allocations: [{ lotId: "a", qty: 10 }] })],
      lots,
      0.3,
    );
    expect(r.taxApplied).toBe(true);
  });
});

describe("reallocate", () => {
  const lots = [lot("old", "2020-01-01", 5, 100), lot("new", "2024-01-01", 5, 120)];

  it("gives a back-dated sale the oldest lot even if a later sale was recorded first", () => {
    const { allocations, short } = reallocate(lots, [
      { id: "june", date: "2025-06-01", qty: 5 },
      { id: "march", date: "2025-03-01", qty: 5 },
    ]);
    expect(short).toBeNull();
    expect(allocations.get("march")).toEqual([{ lotId: "old", qty: 5 }]);
    expect(allocations.get("june")).toEqual([{ lotId: "new", qty: 5 }]);
  });

  it("reports the sale that cannot be covered", () => {
    const { short } = reallocate(lots, [{ id: "big", date: "2025-01-01", qty: 11 }]);
    expect(short?.id).toBe("big");
  });

  it("only uses lots bought on or before the sale date", () => {
    const { short } = reallocate(lots, [{ id: "early", date: "2022-01-01", qty: 6 }]);
    expect(short?.id).toBe("early");
  });
});
