import { describe, expect, it } from "vitest";
import type { RealisedRow } from "../../domain/gains";
import { toCsv } from "./summary";

const row = (over: Partial<RealisedRow>): RealisedRow =>
  ({
    id: "1", kind: "sale", date: "2025-04-01", fy: "2025-26", assetType: "equity", label: "ITC", qty: 1,
    proceeds: 10, cost: 5, stcg: 5, ltcg: 0, gain: 5, taxApplied: true, tax: 1, netGain: 4, note: "",
    ...over,
  }) as RealisedRow;

describe("toCsv", () => {
  it("makes text that starts like a formula literal", () => {
    const csv = toCsv([row({ label: '=HYPERLINK("http://x")', note: "+1 call" })]);
    expect(csv).toContain(`"'=HYPERLINK(""http://x"")"`);
    expect(csv).toContain("'+1 call");
  });

  it("leaves negative numbers alone and quotes line breaks", () => {
    const csv = toCsv([row({ gain: -5, note: "a\r\nb" })]);
    expect(csv).toContain(",-5,");
    expect(csv).toContain('"a\r\nb"');
  });
});
