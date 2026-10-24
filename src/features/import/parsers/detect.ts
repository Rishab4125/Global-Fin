import { readSheets, type Sheet } from "../reportReader";
import type { ParseResult, ParsedFile } from "../types";
import { parseGrowwOrders } from "./groww";
import { parsePnlRows } from "./pnl";
import { parseZerodhaTradebookRows } from "./zerodha";

type RowParser = (rows: string[][]) => ParseResult | null;

/** Sources are stored with each trade id, so they must stay stable. "zerodha_csv" is the original tradebook source. */
const FORMATS: Record<string, [source: string, parse: RowParser][]> = {
  zerodha: [
    ["zerodha_csv", parseZerodhaTradebookRows],
    ["zerodha_pnl", parsePnlRows],
  ],
  groww: [
    ["groww_orders", parseGrowwOrders],
    ["groww_pnl", parsePnlRows],
  ],
};

const HELP: Record<string, string> = {
  zerodha:
    "Upload the Tradebook (Console > Reports > Tradebook) or the P&L report that lists each trade with its entry and exit date, as CSV or XLSX.",
  groww:
    "Upload the stock Order history or the stock Profit & Loss report that lists each trade with its buy and sell date, as CSV or XLSX.",
};

/** Detect which report this is and turn it into normalized trades. Every matching sheet is merged. */
export function parseSheets(broker: string, sheets: Sheet[]): ParsedFile {
  const formats = FORMATS[broker];
  if (!formats) return { trades: [], skipped: [], source: "", error: "That broker isn't supported yet." };

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
