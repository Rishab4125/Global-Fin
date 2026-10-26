import { readSheets, type Sheet } from "../reportReader";
import { norm } from "./common";
import type { ParseResult, ParsedFile } from "../types";
import { parseGrowwOrders } from "./groww";
import { parsePnlRows } from "./pnl";

type RowParser = (rows: string[][]) => ParseResult | null;

/**
 * Only two kinds of report are accepted: Zerodha's P&L and Groww's stock P&L or stock order history.
 * Sources are stored with each trade id, so these names must stay stable ("zerodha_csv" is the retired tradebook source).
 */
const FORMATS: Record<string, [source: string, parse: RowParser][]> = {
  zerodha: [["zerodha_pnl", parsePnlRows]],
  groww: [
    ["groww_orders", parseGrowwOrders],
    ["groww_pnl", parsePnlRows],
  ],
};

const HELP: Record<string, string> = {
  zerodha: "Upload the P&L report from Zerodha Console (Reports > P&L), not the Tax P&L, as CSV or XLSX.",
  groww: "Upload the stock Order history or the stock Profit & Loss report from Groww, as CSV or XLSX.",
};

/** The Tax P&L (capital gains statement) carries tax columns the plain P&L does not. */
const isTaxPnl = (sheets: Sheet[]) =>
  sheets.some((s) => s.rows.slice(0, 40).some((r) => r.some((c) => ["taxableprofit", "taxpl", "taxprofitandloss"].includes(norm(c)))));

/** Detect which report this is and turn it into normalized trades. Every matching sheet is merged. */
export function parseSheets(broker: string, sheets: Sheet[]): ParsedFile {
  const formats = FORMATS[broker];
  if (!formats) return { trades: [], skipped: [], source: "", error: "That broker isn't supported yet." };

  if (broker === "zerodha" && isTaxPnl(sheets)) {
    return {
      trades: [],
      skipped: [],
      source: "",
      error: "This looks like the Tax P&L report. Download the P&L report instead (Console > Reports > P&L).",
    };
  }

  for (const [source, parse] of formats) {
    const matched = sheets.map((s) => parse(s.rows)).filter((r): r is ParseResult => r !== null);
    if (matched.length) {
      return {
        source,
        trades: matched.flatMap((r) => r.trades),
        skipped: matched.flatMap((r) => r.skipped),
      };
    }
  }
  return { trades: [], skipped: [], source: "", error: `Couldn't recognise this file. ${HELP[broker]}` };
}

export async function parseBrokerFile(broker: string, file: File): Promise<ParsedFile> {
  try {
    return parseSheets(broker, await readSheets(file));
  } catch (e) {
    const message = e instanceof Error && e.message.startsWith("Old .xls") ? e.message : "Couldn't read this file.";
    return { trades: [], skipped: [], source: "", error: message };
  }
}
