import { describe, expect, it } from "vitest";
import { fyOptions, fyRange, inPeriod, resolvePeriod } from "./period";

describe("period", () => {
  it("defaults to the current financial year", () => {
    const p = resolvePeriod({}, "2026-10-24");
    expect(p.value).toBe("fy:2026-27");
    expect(p.from).toBe("2026-04-01");
    expect(p.to).toBe("2027-03-31");
  });

  it("uses the previous year when today is before April", () => {
    expect(resolvePeriod({}, "2027-02-10").value).toBe("fy:2026-27");
    expect(resolvePeriod({}, "2026-03-31").value).toBe("fy:2025-26");
  });

  it("supports an explicit year, all time and custom range", () => {
    expect(resolvePeriod({ period: "fy:2024-25" }, "2026-10-24")).toMatchObject({
      from: "2024-04-01",
      to: "2025-03-31",
    });
    expect(resolvePeriod({ period: "all" }, "2026-10-24")).toMatchObject({ from: null, to: null });
    expect(resolvePeriod({ period: "custom", from: "2025-06-01", to: "2025-09-30" }, "2026-10-24")).toMatchObject({
      value: "custom",
      from: "2025-06-01",
      to: "2025-09-30",
    });
  });

  it("swaps a reversed custom range and falls back on bad input", () => {
    expect(resolvePeriod({ period: "custom", from: "2025-09-30", to: "2025-06-01" }, "2026-10-24")).toMatchObject({
      from: "2025-06-01",
      to: "2025-09-30",
    });
    expect(resolvePeriod({ period: "custom", from: "nope", to: "2025-06-01" }, "2026-10-24").value).toBe("fy:2026-27");
    expect(resolvePeriod({ period: "fy:garbage" }, "2026-10-24").value).toBe("fy:2026-27");
  });

  it("lists financial years from the earliest record to now, newest first", () => {
    expect(fyOptions("2023-06-12", "2026-10-24")).toEqual(["2026-27", "2025-26", "2024-25", "2023-24"]);
    expect(fyOptions(null, "2026-10-24")).toEqual(["2026-27"]);
  });

  it("checks whether a date is in a period (inclusive)", () => {
    const p = resolvePeriod({ period: "fy:2025-26" }, "2026-10-24");
    expect(inPeriod("2025-04-01", p)).toBe(true);
    expect(inPeriod("2026-03-31", p)).toBe(true);
    expect(inPeriod("2026-04-01", p)).toBe(false);
    expect(fyRange("2025-26").to).toBe("2026-03-31");
  });
});
