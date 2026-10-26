import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { classifyTrade, looseKey } from "../../../domain/brokerSync";
import { toIsoDate, toNumber } from "./common";
import { parseSheets, parseBrokerFile } from "./detect";
import { parseGrowwOrders } from "./groww";
import { parsePnlRows } from "./pnl";

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
  ["Client ID", "AB1234"],
  [],
  ["Symbol", "ISIN", "Entry Date", "Exit Date", "Quantity", "Buy Value", "Sell Value", "Profit", "Period of Holding"],
  ["RELIANCE", "INE002A01018", "2024-01-10", "2025-02-20", "10", "25000", "31000", "6000", "406"],
  ["TCS", "INE467B01029", "2025-01-05", "2025-01-05", "5", "19000", "19500", "500", "0"],
  ["NIFTY25FEBFUT", "", "2025-02-01", "2025-02-03", "50", "100", "120", "20", "2"],
  ["Total", "", "", "", "", "", "", "6500", ""],
];

describe("parsePnlRows", () => {
  it("turns each closed position into a buy and a sell with per-unit prices", () => {
    const r = parsePnlRows(zerodhaPnl)!;
    const rel = r.trades.filter((t) => t.symbol === "RELIANCE");
    expect(rel.map((t) => [t.side, t.date, t.qty, t.price])).toEqual([
      ["buy", "2024-01-10", 10, 2500],
      ["sell", "2025-02-20", 10, 3100],
    ]);
    expect(rel[0].isin).toBe("INE002A01018");
  });

  it("skips rows without an ISIN and total rows", () => {
    const r = parsePnlRows(zerodhaPnl)!;
    expect(r.trades.some((t) => t.symbol === "NIFTY25FEBFUT")).toBe(false);
    expect(r.skipped.some((s) => s.startsWith("NIFTY25FEBFUT"))).toBe(true);
    expect(r.trades.some((t) => t.symbol === "Total")).toBe(false);
  });

  it("gives identical rows distinct but repeatable ids", () => {
    const row = ["INFY", "INE009A01021", "2025-01-01", "2025-02-01", "5", "7000", "7500"];
    const header = ["Symbol", "ISIN", "Entry Date", "Exit Date", "Quantity", "Buy Value", "Sell Value"];
    const a = parsePnlRows([header, row, row])!;
    const b = parsePnlRows([header, row, row])!;
    const ids = a.trades.map((t) => t.tradeId);
    expect(new Set(ids).size).toBe(4);
    expect(ids).toEqual(b.trades.map((t) => t.tradeId));
  });

  it("reads Groww-style P&L with buy and sell prices", () => {
    const r = parsePnlRows([
      ["Stock name", "ISIN", "Quantity", "Buy date", "Buy price", "Buy value", "Sell date", "Sell price", "Sell value", "Remark"],
      ["Infosys Ltd", "INE009A01021", "4", "10-01-2025", "1500", "6000", "20-03-2025", "1600", "6400", "Short term"],
    ])!;
    expect(r.trades.map((t) => [t.side, t.date, t.price])).toEqual([
      ["buy", "2025-01-10", 1500],
      ["sell", "2025-03-20", 1600],
    ]);
    expect(r.trades[0].symbol).toBe("Infosys Ltd");
  });

  it("refuses summary reports that have no dates", () => {
    expect(parsePnlRows([["Symbol", "ISIN", "Quantity", "Buy Value", "Sell Value", "Realized P&L"]])).toBeNull();
  });

  it("skips short sales", () => {
    const r = parsePnlRows([
      ["Symbol", "ISIN", "Entry Date", "Exit Date", "Quantity", "Buy Value", "Sell Value"],
      ["SBIN", "INE062A01020", "2025-02-02", "2025-02-01", "1", "100", "110"],
    ])!;
    expect(r.trades).toHaveLength(0);
    expect(r.skipped).toHaveLength(1);
  });
});

describe("parseGrowwOrders", () => {
  const header = [
    "Stock name", "Symbol", "ISIN", "Type", "Quantity", "Value", "Exchange", "Exchange Order Id",
    "Executed date and time", "Order status",
  ];
  it("reads executed orders and skips others", () => {
    const r = parseGrowwOrders([
      header,
      ["Reliance Industries", "RELIANCE", "INE002A01018", "BUY", "10", "28500", "NSE", "O1", "05-03-2025 10:15 AM", "Executed"],
      ["Reliance Industries", "RELIANCE", "INE002A01018", "SELL", "4", "12400", "NSE", "O2", "20-03-2025 11:00 AM", "Executed"],
      ["Reliance Industries", "RELIANCE", "INE002A01018", "BUY", "1", "2900", "NSE", "O3", "21-03-2025 11:00 AM", "Rejected"],
    ])!;
    expect(r.trades.map((t) => [t.side, t.date, t.qty, t.price, t.tradeId])).toEqual([
      ["buy", "2025-03-05", 10, 2850, "O1"],
      ["sell", "2025-03-20", 4, 3100, "O2"],
    ]);
    expect(r.trades[0].symbol).toBe("RELIANCE");
    expect(r.skipped).toHaveLength(1);
  });

  it("suffixes repeated order ids so each fill is kept", () => {
    const row = ["A", "A", "I1", "BUY", "1", "10", "NSE", "O1", "05-03-2025", "Executed"];
    const r = parseGrowwOrders([header, row, row])!;
    expect(r.trades.map((t) => t.tradeId)).toEqual(["O1", "O1#2"]);
  });
});

describe("parseSheets", () => {
  it("picks the matching report type and merges matching sheets", () => {
    const out = parseSheets("zerodha", [
      { name: "Summary", rows: [["Client ID", "X"]] },
      { name: "Tradewise Exits", rows: zerodhaPnl },
    ]);
    expect(out.source).toBe("zerodha_pnl");
    expect(out.trades.length).toBe(4);
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
    expect(parseSheets("groww", [{ name: "x", rows: [["a", "b"]] }]).error).toMatch(/Order history/);
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
  it("reads an .xlsx P&L workbook, including date cells", async () => {
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet("Summary").addRow(["Client ID", "AB1234"]);
    const ws = wb.addWorksheet("Tradewise Exits");
    ws.addRow(["Symbol", "ISIN", "Entry Date", "Exit Date", "Quantity", "Buy Value", "Sell Value"]);
    ws.addRow(["RELIANCE", "INE002A01018", new Date(Date.UTC(2024, 0, 10)), new Date(Date.UTC(2025, 1, 20)), 10, 25000, 31000]);
    const buf = Buffer.from(await wb.xlsx.writeBuffer());
    const file = new File([buf], "pnl.xlsx");

    const out = await parseBrokerFile("zerodha", file);
    expect(out.error).toBeUndefined();
    expect(out.source).toBe("zerodha_pnl");
    expect(out.trades.map((t) => [t.side, t.date, t.price])).toEqual([
      ["buy", "2024-01-10", 2500],
      ["sell", "2025-02-20", 3100],
    ]);
  });

  it("rejects old .xls files with a helpful message", async () => {
    const out = await parseBrokerFile("groww", new File(["x"], "report.xls"));
    expect(out.error).toMatch(/\.xlsx/);
  });
});

describe("cross-report duplicates", () => {
  it("flags a P&L trade that matches one already imported from a tradebook", () => {
    const loose = new Set([looseKey("a1", "2025-01-02", "buy", 10)]);
    const t = { date: "2025-01-02", side: "buy", qty: 10, price: 100.4 };
    expect(classifyTrade("zerodha_pnl:x:b", "a1", t, new Set(), new Set(), loose)).toBe("possible_duplicate");
    expect(classifyTrade("zerodha_pnl:x:b", "a2", t, new Set(), new Set(), loose)).toBe("new");
  });
});
