import { existsSync, readFileSync } from "node:fs";
import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { classifyTrade, looseKey } from "../../../domain/brokerSync";
import { toIsoDate, toNumber } from "./common";
import { parseSheets, parseBrokerFile } from "./detect";
import { buildPlan } from "../plan";
import { parseGrowwOrders } from "./groww";
import { parseZerodhaPnl } from "./zerodhaPnl";

describe("toIsoDate / toNumber", () => {
  it("reads the date styles brokers use", () => {
    expect(toIsoDate("2025-03-05")).toBe("2025-03-05");
    expect(toIsoDate("2025-03-05T10:15:00")).toBe("2025-03-05");
    expect(toIsoDate("05-03-2025 10:15 AM")).toBe("2025-03-05");
    expect(toIsoDate("5/3/2025")).toBe("2025-03-05");
    expect(toIsoDate("05 Mar 2025")).toBe("2025-03-05");
    expect(toIsoDate("Mar 05, 2025")).toBe("2025-03-05");
    expect(toIsoDate("45721")).toBe("2025-03-05");
    expect(toIsoDate("not a date")).toBeNull();
  });
  it("reads amounts with symbols and brackets", () => {
    expect(toNumber("₹1,234.50")).toBe(1234.5);
    expect(toNumber("(500)")).toBe(-500);
    expect(toNumber("")).toBeNaN();
  });
});

const zerodhaPnl = [
  [],
  ["", "Client ID", "AB1234"],
  ["", "P&L Statement for Equity from 2025-12-01 to 2026-10-27"],
  ["", "Summary"],
  ["", "Realized P&L", "6000"],
  [],
  ["", "Symbol", "ISIN", "Quantity", "Buy Value", "Sell Value", "Realized P&L", "Realized P&L Pct.", "Previous Closing Price", "Open Quantity", "Open Quantity Type", "Open Value", "Unrealized P&L"],
  ["", "RELIANCE", "INE002A01018", "10", "25000", "31000", "6000", "24", "0", "0", "", "0", "0"],
  ["", "ATHERENERG", "INE0LEZ01016", "0", "0", "0", "0", "0", "1575", "4", "", "4356.5", "1943.5"],
  ["", "TCS", "INE467B01029", "5", "19000", "19500", "500", "2.6", "3900", "2", "", "7000", "800"],
];

describe("parseZerodhaPnl", () => {
  it("dates realised buys at the period start and sells at the period end", () => {
    const r = parseZerodhaPnl(zerodhaPnl)!;
    const rel = r.trades.filter((t) => t.symbol === "RELIANCE");
    expect(rel.map((t) => [t.side, t.date, t.qty, t.price])).toEqual([
      ["buy", "2025-12-01", 10, 2500],
      ["sell", "2026-10-27", 10, 3100],
    ]);
    expect(rel[0].isin).toBe("INE002A01018");
  });

  it("turns open quantity into a buy at cost, with or without realised units", () => {
    const r = parseZerodhaPnl(zerodhaPnl)!;
    const ather = r.trades.filter((t) => t.symbol === "ATHERENERG");
    expect(ather.map((t) => [t.side, t.date, t.qty, t.price])).toEqual([["buy", "2025-12-01", 4, 1089.125]]);
    const tcs = r.trades.filter((t) => t.symbol === "TCS");
    expect(tcs.map((t) => [t.side, t.qty])).toEqual([["buy", 5], ["sell", 5], ["buy", 2]]);
  });

  it("gives every trade a distinct, repeatable id", () => {
    const a = parseZerodhaPnl(zerodhaPnl)!.trades.map((t) => t.tradeId);
    const b = parseZerodhaPnl(zerodhaPnl)!.trades.map((t) => t.tradeId);
    expect(new Set(a).size).toBe(a.length);
    expect(a).toEqual(b);
  });

  it("errors when the report period is missing", () => {
    const noPeriod = zerodhaPnl.filter((r) => !String(r[1]).startsWith("P&L Statement"));
    expect(parseZerodhaPnl(noPeriod)!.error).toMatch(/period/);
  });

  it("ignores the dated Tax P&L layout", () => {
    expect(
      parseZerodhaPnl([
        ["Symbol", "ISIN", "Entry Date", "Exit Date", "Quantity", "Buy Value", "Sell Value"],
        ["A", "I1", "2025-01-01", "2025-02-01", "1", "10", "12"],
      ]),
    ).toBeNull();
  });
});

describe("parseGrowwOrders", () => {
  const header = [
    "Stock name", "Symbol", "ISIN", "Type", "Quantity", "Value", "Exchange", "Exchange Order Id",
    "Execution date and time", "Order status",
  ];
  it("reads executed orders and skips others", () => {
    const r = parseGrowwOrders([
      header,
      ["Reliance Industries", "RELIANCE", "INE002A01018", "BUY", "10", "28500", "NSE", "O1", "05-03-2025 10:15 AM", "Executed"],
      ["Reliance Industries", "RELIANCE", "INE002A01018", "SELL", "4", "12400", "NSE", "O2", "20-03-2025 11:00 AM", "Executed"],
      ["Reliance Industries", "RELIANCE", "INE002A01018", "BUY", "1", "2900", "NSE", "O3", "21-03-2025 11:00 AM", "Rejected"],
    ])!;
    expect(r.trades.map((t) => [t.side, t.date, t.qty, t.price, t.legacyTradeId])).toEqual([
      ["buy", "2025-03-05", 10, 2850, "O1"],
      ["sell", "2025-03-20", 4, 3100, "O2"],
    ]);
    expect(r.trades[0].symbol).toBe("RELIANCE");
    expect(r.skipped).toHaveLength(1);
  });

  it("gives the same ids however the rows are ordered or trimmed", () => {
    const fills = [
      ["A", "A", "I1", "BUY", "1", "10", "NSE", "O1", "05-03-2025 10:00 AM", "Executed"],
      ["A", "A", "I1", "BUY", "2", "30", "NSE", "O1", "05-03-2025 10:01 AM", "Executed"],
    ];
    const ids = (rows: string[][]) => new Map(parseGrowwOrders([header, ...rows])!.trades.map((t) => [t.qty, t.tradeId]));
    const forward = ids(fills);
    const reversed = ids([...fills].reverse());
    const partial = ids([fills[1]]);
    expect(reversed.get(1)).toBe(forward.get(1));
    expect(reversed.get(2)).toBe(forward.get(2));
    expect(partial.get(2)).toBe(forward.get(2));
  });

  it("keeps the old order-id form so earlier imports still count as imported", () => {
    const row = ["A", "A", "I1", "BUY", "1", "10", "NSE", "O1", "05-03-2025", "Executed"];
    const r = parseGrowwOrders([header, row, row])!;
    expect(r.trades.map((t) => t.legacyTradeId)).toEqual(["O1", "O1#2"]);
  });

  it("suffixes repeated order ids so each fill is kept", () => {
    const row = ["A", "A", "I1", "BUY", "1", "10", "NSE", "O1", "05-03-2025", "Executed"];
    const r = parseGrowwOrders([header, row, row])!;
    expect(new Set(r.trades.map((t) => t.tradeId)).size).toBe(2);
  });
});

describe("parseSheets", () => {
  it("picks the matching report type and merges matching sheets", () => {
    const out = parseSheets("zerodha", [
      { name: "Summary", rows: [["Client ID", "X"]] },
      { name: "Equity", rows: zerodhaPnl },
    ]);
    expect(out.source).toBe("zerodha_pnl");
    expect(out.trades.length).toBe(6);
  });

  it("keeps one trade when two sheets contain the same P&L rows", () => {
    const out = parseSheets("zerodha", [
      { name: "Equity", rows: zerodhaPnl },
      { name: "Equity copy", rows: zerodhaPnl },
    ]);
    expect(out.trades).toHaveLength(6);
    expect(out.skipped.some((x) => /another sheet/.test(x))).toBe(true);
  });

  it("no longer accepts the Zerodha tradebook", () => {
    const out = parseSheets("zerodha", [
      {
        name: "x.csv",
        rows: [
          ["symbol", "isin", "trade_date", "segment", "trade_type", "quantity", "price", "trade_id"],
          ["RELIANCE", "INE002A01018", "2025-01-02", "EQ", "buy", "10", "100", "111"],
        ],
      },
    ]);
    expect(out.trades).toHaveLength(0);
    expect(out.error).toMatch(/P&L/);
  });

  it("explains what to upload when nothing matches", () => {
    expect(parseSheets("groww", [{ name: "x", rows: [["a", "b"]] }]).error).toMatch(/order history/i);
    expect(parseSheets("zerodha", [{ name: "x", rows: [["a"]] }]).error).toMatch(/Reports > P&L/);
  });

  it("rejects the Zerodha Tax P&L with a pointer to the plain P&L", () => {
    const out = parseSheets("zerodha", [
      {
        name: "Tradewise Exits",
        rows: [["Symbol", "ISIN", "Entry Date", "Exit Date", "Quantity", "Buy Value", "Sell Value", "Profit", "Taxable Profit"]],
      },
    ]);
    expect(out.trades).toHaveLength(0);
    expect(out.error).toMatch(/Tax P&L/);
  });
});

describe("reading real files", () => {
  it("reads an .xlsx Zerodha P&L workbook whose table starts in column B", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Equity");
    zerodhaPnl.forEach((r, i) => r.length && (ws.getRow(i + 1).values = [undefined, ...r.map((x) => (/^-?\d+(\.\d+)?$/.test(x) ? Number(x) : x))]));
    wb.addWorksheet("Other Debits and Credits").addRow(["Particulars", "Posting Date", "Debit", "Credit"]);
    const file = new File([Buffer.from(await wb.xlsx.writeBuffer())], "pnl.xlsx");

    const out = await parseBrokerFile("zerodha", file);
    expect(out.error).toBeUndefined();
    expect(out.source).toBe("zerodha_pnl");
    expect(out.trades.filter((t) => t.symbol === "RELIANCE").map((t) => [t.side, t.date, t.price])).toEqual([
      ["buy", "2025-12-01", 2500],
      ["sell", "2026-10-27", 3100],
    ]);
  });

  it("reads an .xlsx Groww order history with its header below the client details", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Sheet1");
    ws.addRow(["Name", "A User"]);
    ws.addRow(["Order history for stocks from 01-12-2025 to 26-10-2026"]);
    ws.addRow([]);
    ws.addRow(["Stock name", "Symbol", "ISIN", "Type", "Quantity", "Value", "Exchange", "Exchange Order Id", "Execution date and time", "Order status"]);
    ws.addRow(["ITC LTD", "ITC", "INE154A01025", "BUY", 2, 760, "NSE", "1100000016708891", "01-01-2026 10:08 AM", "Executed"]);
    const out = await parseBrokerFile("groww", new File([Buffer.from(await wb.xlsx.writeBuffer())], "orders.xlsx"));
    expect(out.source).toBe("groww_orders");
    expect(out.trades.map((t) => [t.side, t.date, t.qty, t.price])).toEqual([["buy", "2026-01-01", 2, 380]]);
  });

  it("rejects old .xls files with a helpful message", async () => {
    const out = await parseBrokerFile("groww", new File(["x"], "report.xls"));
    expect(out.error).toMatch(/\.xlsx/);
  });
});

describe("cross-report duplicates", () => {
  it("flags a trade that matches one already imported from another report", () => {
    const loose = new Set([looseKey("a1", "2025-01-02", "buy", 10)]);
    const t = { date: "2025-01-02", side: "buy", qty: 10, price: 100.4 };
    expect(classifyTrade("zerodha_pnl:x:b", "a1", t, new Set(), new Set(), loose)).toBe("possible_duplicate");
    expect(classifyTrade("zerodha_pnl:x:b", "a2", t, new Set(), new Set(), loose)).toBe("new");
  });
});

/** Runs against the sample reports in pl_example/ (not committed); skipped when the folder is absent. */
const sample = (name: string) => `pl_example/${name}`;
const zerodhaSample = sample("pnl-WDD918 (1).xlsx");
const growwSample = sample("Stocks_Order_History_2290118049_2025-12-01_2026-10-26.xlsx");

describe.skipIf(!existsSync(zerodhaSample) || !existsSync(growwSample))("sample reports", () => {
  const load = (path: string) => new File([readFileSync(path)], path.split("/").pop()!);

  it("imports the Zerodha P&L sample", async () => {
    const out = await parseBrokerFile("zerodha", load(zerodhaSample));
    expect(out.error).toBeUndefined();
    expect(out.source).toBe("zerodha_pnl");
    expect(out.trades.length).toBeGreaterThan(10);
    expect(out.trades.every((t) => t.isin && t.price > 0 && t.qty > 0)).toBe(true);
  });

  it.each([
    ["zerodha", zerodhaSample, "zerodha_pnl"],
    ["groww", growwSample, "groww_orders"],
  ])("a second import of the %s sample adds nothing", async (broker, path, source) => {
    const out = await parseBrokerFile(broker, load(path));
    const input = { trades: out.trades, source, assets: [], lots: [], sales: [], manualKeys: new Set<string>(), mapping: new Map(), includeDuplicates: new Set<string>(), replaceEstimated: false };
    const first = buildPlan({ ...input, importedKeys: new Set() });
    expect(first.lots.length + first.sales.length).toBeGreaterThan(0);
    const stored = new Set([...first.lots, ...first.sales].map((x) => `${source}:${x.tradeId}`));
    const second = buildPlan({ ...input, importedKeys: stored });
    expect(second.lots.length + second.sales.length).toBe(0);
    expect(second.rows.every((r) => r.status === "imported")).toBe(true);
  });

  it("imports the Groww order history sample", async () => {
    const out = await parseBrokerFile("groww", load(growwSample));
    expect(out.error).toBeUndefined();
    expect(out.source).toBe("groww_orders");
    expect(out.trades).toHaveLength(13);
    expect(out.trades.filter((t) => t.side === "sell")).toHaveLength(3);
  });
});
