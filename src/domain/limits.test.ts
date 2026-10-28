import { describe, expect, it } from "vitest";
import { limitError, placesOf, priceDecimals, qtyDecimals } from "./limits";
import { ASSET_RULES, ASSET_TYPE_IDS, CATEGORIES, type AssetTypeId, type Category, type Exposure } from "./taxRules";

describe("category and exposure of every asset type (PRD 2.3)", () => {
  const expected: Record<AssetTypeId, [Category, Exposure]> = {
    equity: ["Stocks & ETFs", "Equity"],
    equity_mf: ["Mutual Funds", "Equity"],
    debt_mf: ["Mutual Funds", "Debt"],
    bond_listed: ["Bonds", "Debt"],
    bond_unlisted: ["Bonds", "Debt"],
    fd: ["Fixed Deposits", "Debt"],
    rd: ["Fixed Deposits", "Debt"],
    ppf_epf: ["Govt schemes", "Debt"],
    land: ["Real Estate", "Real estate"],
    gold_physical: ["Metals", "Gold"],
    gold_etf: ["Stocks & ETFs", "Gold"],
    sgb: ["Metals", "Gold"],
    crypto: ["Crypto", "Crypto"],
    other: ["Other", "Other"],
  };

  it("maps all 14 types", () => {
    expect(ASSET_TYPE_IDS).toHaveLength(14);
    for (const id of ASSET_TYPE_IDS) {
      expect([ASSET_RULES[id].category, ASSET_RULES[id].exposure]).toEqual(expected[id]);
    }
  });

  it("only uses listed categories, and every category is used", () => {
    const used = new Set(ASSET_TYPE_IDS.map((id) => ASSET_RULES[id].category));
    expect([...used].sort()).toEqual([...CATEGORIES].sort());
  });

  it("keeps gold exposure for the commodity ETF while it sits under Stocks & ETFs", () => {
    expect(ASSET_RULES.gold_etf.category).toBe("Stocks & ETFs");
    expect(ASSET_RULES.gold_etf.exposure).toBe("Gold");
    expect(ASSET_RULES.gold_etf.label).not.toMatch(/gold etf/i);
  });

  it("leaves tax treatment untouched by the regrouping", () => {
    expect(ASSET_RULES.gold_etf.ltcg).toEqual({ kind: "flat", rate: 0.125 });
    expect(ASSET_RULES.gold_etf.stcg).toEqual({ kind: "slab" });
    expect(ASSET_RULES.equity.usesEquityExemption).toBe(true);
  });
});

describe("decimal limits (PRD 5.3 D)", () => {
  it("counts decimals, including values printed in exponent form", () => {
    expect(placesOf(12)).toBe(0);
    expect(placesOf(0.125)).toBe(3);
    expect(placesOf(1e-7)).toBe(7);
    expect(placesOf(0.00000001)).toBe(8);
  });

  it("allows decimals by category", () => {
    expect(qtyDecimals("equity")).toBe(0);
    expect(qtyDecimals("gold_etf")).toBe(0);
    expect(qtyDecimals("bond_listed")).toBe(0);
    expect(qtyDecimals("equity_mf")).toBe(4);
    expect(qtyDecimals("gold_physical")).toBe(3);
    expect(qtyDecimals("sgb")).toBe(3);
    expect(qtyDecimals("crypto")).toBe(8);
    expect(qtyDecimals("fd")).toBe(4);
    expect(priceDecimals("crypto")).toBe(8);
    expect(priceDecimals("equity")).toBe(4);
  });

  it("rejects a fractional share and accepts whole ones", () => {
    expect(limitError("equity", { qty: 1.5 })).toMatch(/whole units/i);
    expect(limitError("equity", { qty: 15 })).toBeNull();
  });

  it("rejects a fund unit with 5 decimals but accepts 4", () => {
    expect(limitError("equity_mf", { qty: 10.12345 })).toMatch(/up to 4 decimals/i);
    expect(limitError("equity_mf", { qty: 10.1234 })).toBeNull();
  });

  it("allows 8-decimal crypto quantity and price, and rejects 9", () => {
    expect(limitError("crypto", { qty: 0.00001234, price: 0.00084 })).toBeNull();
    expect(limitError("crypto", { qty: 0.000000001 })).toMatch(/up to 8 decimals/i);
  });

  it("limits a stock price to 4 decimals", () => {
    expect(limitError("equity", { price: 92.9415 })).toBeNull();
    expect(limitError("equity", { price: 92.94155 })).toMatch(/up to 4 decimals/i);
  });
});
