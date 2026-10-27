import { describe, expect, it } from "vitest";
import { activeCount, filterQs, parseMulti, passes, readFilters } from "./filters";

describe("filters", () => {
  it("parses comma lists and repeated params without blanks or repeats", () => {
    expect(parseMulti("a, b,,a")).toEqual(["a", "b"]);
    expect(parseMulti(["a,b", "c"])).toEqual(["a", "b", "c"]);
    expect(parseMulti(undefined)).toEqual([]);
  });

  it("drops values that are not allowed", () => {
    const f = readFilters({ pf: "Zerodha,Bogus", ty: "Equity" }, ["pf", "ty"], { pf: ["Zerodha", "Groww", "Other"] });
    expect(f).toEqual({ pf: ["Zerodha"], ty: ["Equity"] });
  });

  it("builds a query string and counts selections", () => {
    const f = { pf: ["Zerodha", "Groww"], ty: [] };
    expect(filterQs(f)).toBe("pf=Zerodha%2CGroww");
    expect(activeCount(f)).toBe(2);
    expect(filterQs({ pf: [] })).toBe("");
  });

  it("passes everything when nothing is selected and matches any selected value otherwise", () => {
    expect(passes([], "x")).toBe(true);
    expect(passes(["Buy"], "Buy")).toBe(true);
    expect(passes(["Buy"], "Sell")).toBe(false);
    expect(passes(["Short term"], ["", "Short term"])).toBe(true);
    expect(passes(["Zerodha"], undefined)).toBe(false);
  });
});
