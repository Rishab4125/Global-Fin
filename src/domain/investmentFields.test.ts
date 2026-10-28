import { describe, expect, it } from "vitest";
import { decimalsError } from "../lib/numeric";
import { LUMP_SUM, labelsFor, platformKindFor, TYPE_FIELDS, typesByCategory, validateDetails } from "./investmentFields";
import { ASSET_RULES, ASSET_TYPE_IDS, CATEGORIES } from "./taxRules";

describe("sub-types by category", () => {
  const by = typesByCategory();

  it("covers every asset type exactly once", () => {
    const ids = CATEGORIES.flatMap((c) => by[c].map((t) => t.id));
    expect([...ids].sort()).toEqual([...ASSET_TYPE_IDS].sort());
  });

  it("keeps every category non-empty and sub-types distinct within it", () => {
    for (const c of CATEGORIES) {
      expect(by[c].length).toBeGreaterThan(0);
      expect(new Set(by[c].map((t) => t.subType)).size).toBe(by[c].length);
    }
  });

  it("puts gold in Metals and the commodity ETF under Stocks & ETFs", () => {
    expect(by.Metals.map((t) => t.id).sort()).toEqual(["gold_physical", "sgb"]);
    expect(by["Stocks & ETFs"].map((t) => t.id)).toContain("gold_etf");
  });

  it("offers FD and RD together, and listed and unlisted bonds together", () => {
    expect(by["Fixed Deposits"].map((t) => t.id)).toEqual(["fd", "rd"]);
    expect(by.Bonds.map((t) => t.id)).toEqual(["bond_listed", "bond_unlisted"]);
  });
});

describe("required fields per type (PRD 3.3)", () => {
  it("asks an FD for rate and maturity", () => {
    const need = TYPE_FIELDS.fd!.filter((f) => f.required).map((f) => f.key);
    expect(need).toEqual(["rate", "maturity"]);
  });

  it("asks a bond for face value and maturity, a property for type and location, metals for the metal", () => {
    expect(TYPE_FIELDS.bond_listed!.filter((f) => f.required).map((f) => f.key)).toEqual(["faceValue", "maturity"]);
    expect(TYPE_FIELDS.land!.filter((f) => f.required).map((f) => f.key)).toEqual(["propertyType", "location"]);
    expect(TYPE_FIELDS.gold_physical!.filter((f) => f.required).map((f) => f.key)).toEqual(["metal"]);
  });

  it("asks stocks for the exchange only; ISIN stays optional", () => {
    expect(TYPE_FIELDS.equity!.filter((f) => f.required).map((f) => f.key)).toEqual(["exchange"]);
  });

  it("asks nothing extra of crypto or other", () => {
    expect(TYPE_FIELDS.crypto).toBeUndefined();
    expect(TYPE_FIELDS.other).toBeUndefined();
  });

  it("holds FD, RD, PPF and land as a single amount", () => {
    expect([...LUMP_SUM].sort()).toEqual(["fd", "land", "ppf_epf", "rd"]);
  });
});

describe("validateDetails", () => {
  const date = "2025-04-01";

  it("accepts a complete FD", () => {
    const r = validateDetails("fd", { rate: "7.10", maturity: "2027-04-01", compounding: "Quarterly" }, date);
    expect(r.details).toEqual({ rate: 7.1, maturity: "2027-04-01", compounding: "Quarterly" });
  });

  it("names the missing required field", () => {
    expect(validateDetails("fd", { maturity: "2027-04-01" }, date).error).toBe("Interest rate (%) is required");
    expect(validateDetails("land", { propertyType: "Flat" }, date).error).toBe("Location is required");
  });

  it("rejects a maturity on or before the purchase date", () => {
    expect(validateDetails("fd", { rate: "7", maturity: "2025-04-01" }, date).error).toMatch(/after the purchase date/);
    expect(validateDetails("fd", { rate: "7", maturity: "2024-01-01" }, date).error).toMatch(/after the purchase date/);
  });

  it("rejects too many decimals instead of rounding", () => {
    expect(validateDetails("fd", { rate: "7.105", maturity: "2027-04-01" }, date).error).toBe("Interest rate (%): up to 2 decimals");
  });

  it("rejects out-of-range numbers and non-numbers", () => {
    expect(validateDetails("fd", { rate: "0", maturity: "2027-04-01" }, date).error).toMatch(/at least/);
    expect(validateDetails("fd", { rate: "150", maturity: "2027-04-01" }, date).error).toMatch(/more than/);
    expect(validateDetails("fd", { rate: "abc", maturity: "2027-04-01" }, date).error).toMatch(/valid number/);
  });

  it("cleans pasted amounts", () => {
    const r = validateDetails("bond_listed", { faceValue: "₹1,000", maturity: "2030-01-01" }, date);
    expect(r.details?.faceValue).toBe(1000);
  });

  it("rejects an option that is not on the list", () => {
    expect(validateDetails("equity", { exchange: "NASDAQ" }, date).error).toMatch(/pick one/);
  });

  it("skips empty optional fields and rejects a bad date", () => {
    expect(validateDetails("sgb", {}, date).details).toEqual({});
    expect(validateDetails("sgb", { maturity: "2031-02-30" }, date).error).toMatch(/valid date/);
  });

  it("checks and upper-cases an ISIN", () => {
    expect(validateDetails("equity", { exchange: "NSE", isin: "ine002a01018" }, date).details).toEqual({
      exchange: "NSE",
      isin: "INE002A01018",
    });
    expect(validateDetails("equity", { exchange: "NSE", isin: "12345" }, date).error).toMatch(/ISIN/);
  });

  it("needs nothing for types without extra fields", () => {
    expect(validateDetails("crypto", {}, date).details).toEqual({});
  });
});

describe("wording and platform kind", () => {
  it("words the fields by type", () => {
    expect(labelsFor("equity_mf").price).toBe("NAV per unit (₹)");
    expect(labelsFor("fd").price).toBe("Principal (₹)");
    expect(labelsFor("gold_physical").qty).toBe("Weight (grams)");
    expect(labelsFor("ppf_epf").price).toBe("Opening balance (₹)");
  });

  it("gives every type labels", () => {
    for (const id of ASSET_TYPE_IDS) expect(labelsFor(id).name.length).toBeGreaterThan(0);
    expect(ASSET_RULES.fd.category).toBe("Fixed Deposits");
  });

  it("treats banks, lockers and brokers differently", () => {
    expect(platformKindFor("Fixed Deposits")).toBe("bank");
    expect(platformKindFor("Metals")).toBe("self");
    expect(platformKindFor("Stocks & ETFs")).toBe("broker");
  });
});

describe("live decimal check used by the form fields", () => {
  it("flags extra decimals and non-numbers, passes the rest", () => {
    expect(decimalsError("10.123", 2)).toBe("Up to 2 decimals");
    expect(decimalsError("10.5", 0)).toBe("Whole units only");
    expect(decimalsError("10", 0)).toBe("");
    expect(decimalsError("", 2)).toBe("");
    expect(decimalsError("1.", 2)).toBe("");
    expect(decimalsError("abc", 2)).toBe("Enter a number");
  });
});

import { plainNumber } from "../lib/numeric";

describe("plainNumber", () => {
  it("never uses exponent form and drops trailing zeros", () => {
    expect(plainNumber(1.2e-7)).toBe("0.00000012");
    expect(plainNumber(10)).toBe("10");
    expect(plainNumber(100)).toBe("100");
    expect(plainNumber(0.5)).toBe("0.5");
    expect(plainNumber(0)).toBe("0");
    expect(plainNumber(92.9415)).toBe("92.9415");
    expect(plainNumber(1234567.25)).toBe("1234567.25");
  });
});
