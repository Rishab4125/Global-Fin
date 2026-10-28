import { describe, expect, it } from "vitest";
import { detailRows, lotTerms, splitByTerm } from "./detail";
import type { ListLot } from "./list";

const lot = (id: string, buyDate: string, qty: number, unitPrice: number, u = 1, fees = 0): ListLot => ({
  id,
  assetId: "a",
  buyDate,
  qty,
  unitPrice,
  fees,
  platform: "Zerodha",
  u,
});
const none = new Map<string, number>();

describe("lotTerms", () => {
  const today = "2026-10-28";

  it("marks a lot held more than the rule's months as long term", () => {
    const [t] = lotTerms([lot("a", "2025-10-01", 10, 100)], none, 12, today);
    expect(t.term).toBe("long");
    expect(t.longFrom).toBeNull();
  });

  it("tells a short-term lot when it turns long term, the day after the anniversary", () => {
    const [t] = lotTerms([lot("a", "2025-12-15", 10, 100)], none, 12, today);
    expect(t.term).toBe("short");
    expect(t.longFrom).toBe("2026-12-16");
    expect(t.daysToLong).toBe(49);
  });

  it("is still short term on the anniversary itself and long term the next day", () => {
    expect(lotTerms([lot("a", "2025-10-28", 1, 1)], none, 12, "2026-10-28")[0].term).toBe("short");
    expect(lotTerms([lot("a", "2025-10-28", 1, 1)], none, 12, "2026-10-29")[0].term).toBe("long");
  });

  it("handles a month-end buy date", () => {
    expect(lotTerms([lot("a", "2025-02-28", 1, 1)], none, 12, "2025-06-01")[0].longFrom).toBe("2026-03-01");
  });

  it("reports no term for assets taxed the same whatever the holding period", () => {
    const [t] = lotTerms([lot("a", "2025-01-01", 10, 100)], none, null, today);
    expect(t.term).toBe("none");
    expect(t.longFrom).toBeNull();
  });

  it("skips sold-out lots and sizes a part-sold one by what is left", () => {
    const sold = new Map([["a", 4], ["b", 10]]);
    const t = lotTerms([lot("a", "2024-01-01", 10, 100), lot("b", "2024-01-01", 10, 100)], sold, 12, today);
    expect(t).toHaveLength(1);
    expect(t[0].qty).toBe(6);
    expect(t[0].cost).toBe(600);
  });

  it("shows quantity in today's units after a split and keeps the cost", () => {
    const [t] = lotTerms([lot("a", "2024-01-01", 10, 1000)], none, 12, today, 5);
    expect(t.qty).toBe(50);
    expect(t.cost).toBe(10000);
  });

  it("includes fees in cost and lists oldest first", () => {
    const t = lotTerms([lot("n", "2025-06-01", 10, 100, 1, 50), lot("o", "2023-01-01", 10, 100)], none, 12, today);
    expect(t.map((x) => x.id)).toEqual(["o", "n"]);
    expect(t[1].cost).toBe(1050);
  });
});

describe("splitByTerm", () => {
  it("adds up short-term and long-term units and cost", () => {
    const terms = lotTerms(
      [lot("a", "2023-01-01", 10, 100), lot("b", "2026-06-01", 5, 200), lot("c", "2024-01-01", 2, 50)],
      none,
      12,
      "2026-10-28",
    );
    expect(splitByTerm(terms)).toEqual({ shortQty: 5, shortCost: 1000, longQty: 12, longCost: 1100 });
  });

  it("ignores lots with no holding-period concept", () => {
    const terms = lotTerms([lot("a", "2024-01-01", 10, 100)], none, null, "2026-10-28");
    expect(splitByTerm(terms)).toEqual({ shortQty: 0, shortCost: 0, longQty: 0, longCost: 0 });
  });
});

describe("detailRows", () => {
  it("lists saved FD details with readable values", () => {
    const rows = detailRows("fd", null, { rate: 7.1, maturity: "2027-04-01", compounding: "Quarterly", nickname: "Dad" });
    expect(rows).toEqual([
      { label: "Interest rate", value: "7.1%" },
      { label: "Maturity date", value: "01 Apr 2027" },
      { label: "Compounding", value: "Quarterly" },
      { label: "Account nickname", value: "Dad" },
    ]);
  });

  it("puts the ISIN first and leaves out empty fields", () => {
    const rows = detailRows("equity", "INE002A01018", { exchange: "NSE" });
    expect(rows).toEqual([
      { label: "ISIN", value: "INE002A01018" },
      { label: "Exchange", value: "NSE" },
    ]);
  });

  it("formats face value in rupees", () => {
    expect(detailRows("bond_listed", null, { faceValue: 100000, maturity: "2030-01-01" })[0]).toEqual({
      label: "Face value",
      value: "₹1,00,000",
    });
  });

  it("returns nothing for a type with no saved details", () => {
    expect(detailRows("crypto", null, {})).toEqual([]);
  });
});
