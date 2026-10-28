import { describe, expect, it } from "vitest";
import { cleanNumeric, money, number, qty } from "./validation";

const ok = (schema: ReturnType<typeof number>, v: unknown) => schema.safeParse(v);

describe("pasted numbers are cleaned", () => {
  it("strips the rupee sign, commas and spaces", () => {
    expect(cleanNumeric("₹1,25,000.50")).toBe("125000.50");
    expect(money("amount").parse("₹ 1,25,000.50")).toBe(125000.5);
    expect(number("price").parse(" 1,250 ")).toBe(1250);
  });

  it("leaves non-text values alone", () => {
    expect(cleanNumeric(5)).toBe(5);
    expect(cleanNumeric(null)).toBeNull();
  });
});

describe("decimal limits are rejected, never rounded", () => {
  it("allows 2 decimals for money and rejects 3 with a message", () => {
    expect(ok(money("fees"), "10.25").success).toBe(true);
    const bad = ok(money("fees"), "10.255");
    expect(bad.success).toBe(false);
    if (!bad.success) expect(bad.error.issues[0].message).toBe("Fees: up to 2 decimals");
  });

  it("applies the limit to pasted values too", () => {
    expect(ok(money("amount"), "₹1,000.999").success).toBe(false);
  });

  it("limits a slab rate to 2 decimals", () => {
    const rate = number("tax rate", { max: 45, decimals: 2 });
    expect(ok(rate, "31.2").success).toBe(true);
    expect(ok(rate, "31.255").success).toBe(false);
  });
});

describe("existing rules still hold", () => {
  it("treats an empty field as an error, not zero", () => {
    expect(ok(number("price"), "").success).toBe(false);
  });

  it("requires quantity above zero and below the cap", () => {
    expect(ok(qty(), "0").success).toBe(false);
    expect(ok(qty(), "-1").success).toBe(false);
    expect(ok(qty(), "1e10").success).toBe(true);
    expect(ok(qty(), "1e11").success).toBe(false);
  });

  it("accepts an 8-decimal quantity here; the category check happens per asset type", () => {
    expect(ok(qty(), "0.00001234").success).toBe(true);
  });

  it("allows zero for price and fees but not negatives", () => {
    expect(ok(number("price"), "0").success).toBe(true);
    expect(ok(number("price"), "-5").success).toBe(false);
  });

  it("allows a negative misc amount when asked", () => {
    expect(money("amount", { min: -1e12 }).parse("-3200")).toBe(-3200);
  });
});
