import { describe, expect, it } from "vitest";
import {
  csvMoney,
  csvQty,
  formatDayMonth,
  formatINR,
  formatINRCompact,
  formatINRWhole,
  formatPercent,
  formatPrice,
  formatQty,
  formatRate,
  MINUS,
} from "./format";

describe("headline amounts: whole rupees, Indian grouping", () => {
  it("groups in lakhs and crores", () => {
    expect(formatINRWhole(1234567)).toBe("₹12,34,567");
    expect(formatINRWhole(12345678.9)).toBe("₹1,23,45,679");
  });
  it("uses a true minus sign", () => {
    expect(formatINRWhole(-1250)).toBe(`${MINUS}₹1,250`);
    expect(MINUS).not.toBe("-");
  });
  it("shows zero without a sign, even for a tiny negative that rounds to zero", () => {
    expect(formatINRWhole(0)).toBe("₹0");
    expect(formatINRWhole(-0.4)).toBe("₹0");
  });
  it("adds + to gains only when asked", () => {
    expect(formatINRWhole(500)).toBe("₹500");
    expect(formatINRWhole(500, { sign: true })).toBe("+₹500");
    expect(formatINRWhole(-500, { sign: true })).toBe(`${MINUS}₹500`);
  });
});

describe("narrow cards: lakh and crore", () => {
  it("abbreviates from a lakh up", () => {
    expect(formatINRCompact(1234567)).toBe("₹12.3L");
    expect(formatINRCompact(12000000)).toBe("₹1.2Cr");
    expect(formatINRCompact(100000)).toBe("₹1L");
  });
  it("keeps whole rupees under a lakh", () => {
    expect(formatINRCompact(99999)).toBe("₹99,999");
  });
  it("rolls 99.99 lakh up to the crore instead of printing ₹100L", () => {
    expect(formatINRCompact(9999999)).toBe("₹1Cr");
  });
  it("keeps the minus sign", () => {
    expect(formatINRCompact(-1234567)).toBe(`${MINUS}₹12.3L`);
  });
});

describe("table amounts: always two decimals", () => {
  it("pads to the paisa", () => {
    expect(formatINR(45210.5)).toBe("₹45,210.50");
    expect(formatINR(100)).toBe("₹100.00");
    expect(formatINR(-1250)).toBe(`${MINUS}₹1,250.00`);
  });
  it("keeps a sub-rupee loss visible but hides a negative zero", () => {
    expect(formatINR(-0.5)).toBe(`${MINUS}₹0.50`);
    expect(formatINR(-0.001)).toBe("₹0.00");
  });
});

describe("unit price and average cost", () => {
  it("shows two decimals minimum and drops zeros past two", () => {
    expect(formatPrice(182.5)).toBe("₹182.50");
    expect(formatPrice(92.9415)).toBe("₹92.9415");
    expect(formatPrice(62.5)).toBe("₹62.50");
    expect(formatPrice(10.12)).toBe("₹10.12");
    expect(formatPrice(10.1200)).toBe("₹10.12");
  });
  it("allows up to eight decimals for crypto under ₹1 only", () => {
    expect(formatPrice(0.00084, { crypto: true })).toBe("₹0.00084");
    expect(formatPrice(0.00084)).toBe("₹0.0008");
    expect(formatPrice(54000.123456, { crypto: true })).toBe("₹54,000.1235");
  });
});

describe("quantity", () => {
  it("follows the category limit", () => {
    expect(formatQty(120, "equity")).toBe("120");
    expect(formatQty(500, "gold_etf")).toBe("500");
    expect(formatQty(45.321, "equity_mf")).toBe("45.321");
    expect(formatQty(412.3456, "equity_mf")).toBe("412.3456");
    expect(formatQty(20, "gold_physical")).toBe("20");
    expect(formatQty(0.0125, "crypto")).toBe("0.0125");
    expect(formatQty(0.00001234, "crypto")).toBe("0.00001234");
  });
  it("drops trailing zeros and groups large numbers", () => {
    expect(formatQty(1234567, "equity")).toBe("12,34,567");
    expect(formatQty(10.5, "equity_mf")).toBe("10.5");
  });
  it("shows up to 8 decimals when the type is unknown", () => {
    expect(formatQty(0.00000001)).toBe("0.00000001");
  });
});

describe("percentages and rates", () => {
  it("shows one decimal", () => {
    expect(formatPercent(12.44)).toBe("12.4%");
    expect(formatPercent(12)).toBe("12.0%");
    expect(formatPercent(-3.26)).toBe(`${MINUS}3.3%`);
  });
  it("hides the sign of a negative that rounds to 0.0", () => {
    expect(formatPercent(-0.04)).toBe("0.0%");
  });
  it("shows tax rates to two decimals with trailing zeros dropped", () => {
    expect(formatRate(12.5)).toBe("12.5%");
    expect(formatRate(30)).toBe("30%");
    expect(formatRate(31.2)).toBe("31.2%");
    expect(formatRate(7.25)).toBe("7.25%");
  });
});

describe("csv numbers", () => {
  it("writes money with two decimals, no symbol or commas", () => {
    expect(csvMoney(45210.5)).toBe("45210.50");
    expect(csvMoney(1234567.891)).toBe("1234567.89");
    expect(csvMoney(-5)).toBe("-5.00");
    expect(csvMoney(-0.001)).toBe("0.00");
  });
  it("writes quantity with up to eight decimals", () => {
    expect(csvQty(120)).toBe("120");
    expect(csvQty(0.00001234)).toBe("0.00001234");
    expect(csvQty(10.5)).toBe("10.5");
  });
});

describe("formatDayMonth", () => {
  it("shows day and month without the year", () => {
    expect(formatDayMonth("2025-04-02")).toBe("02 Apr");
    expect(formatDayMonth("2026-03-31")).toBe("31 Mar");
  });
});
