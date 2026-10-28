import { describe, expect, it } from "vitest";
import type { RealisedRow } from "../../domain/gains";
import { groupMisc, termSplit, toCsv, totals } from "./summary";

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
    expect(csv).toContain(",-5.00,");
    expect(csv).toContain('"a\r\nb"');
  });
});

describe("termSplit", () => {
  it("divides the gain into short, long and dividend income, and the parts add up", () => {
    const rows = [
      row({ stcg: 100, ltcg: 0, gain: 100, income: 0 }),
      row({ stcg: 0, ltcg: 250.5, gain: 250.5, income: 0 }),
      row({ stcg: 0, ltcg: 0, gain: 40, income: 40 }),
      row({ stcg: 0, ltcg: -30, gain: -30, income: 0 }),
    ];
    const t = termSplit(rows);
    expect(t).toEqual({ short: 100, long: 220.5, income: 40, other: 0, total: 360.5 });
    expect(t.short + t.long + t.income + t.other).toBeCloseTo(t.total, 2);
  });

  it("keeps whatever is not short, long or income in other", () => {
    const t = termSplit([row({ stcg: 0, ltcg: -50, gain: 30, income: 0 })]);
    expect(t.other).toBe(80);
  });
});

describe("groupMisc", () => {
  const typeOf = (r: RealisedRow) => (r.label.startsWith("Dividend") ? "Dividends" : "F&O");
  it("puts dividends first and gives each group its subtotal", () => {
    const rows = [
      row({ kind: "misc", label: "Misc P/L", gain: -3200, tax: 0, netGain: -3200 }),
      row({ kind: "misc", label: "Dividend: ITC", gain: 100, tax: 31, netGain: 69 }),
      row({ kind: "misc", label: "Dividend: TCS", gain: 12300, tax: 3000, netGain: 9300 }),
    ];
    const g = groupMisc(rows, typeOf);
    expect(g.map((x) => x.label)).toEqual(["Dividends", "F&O"]);
    expect(g[0]).toMatchObject({ count: 2, gain: 12400, net: 9369 });
    expect(g[1]).toMatchObject({ count: 1, gain: -3200 });
    expect(g.reduce((s, x) => s + x.net, 0)).toBe(totals(rows).net);
  });
});
