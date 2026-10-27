export type BrokerId = "zerodha" | "groww";

export interface BrokerTrade {
  isin: string | null;
  symbol: string;
  name: string;
  /** ISO yyyy-mm-dd */
  date: string;
  side: "buy" | "sell";
  qty: number;
  price: number;
  /** Stable id for this trade, unique per user and source. Null for derived (sync) trades. */
  tradeId: string | null;
  /** Id this trade was stored under by earlier versions of the parser, so old imports still count as imported. */
  legacyTradeId?: string;
}

export interface ParseResult {
  trades: BrokerTrade[];
  /** Human-readable reasons for rows that were ignored. */
  skipped: string[];
  error?: string;
}

export interface ParsedFile extends ParseResult {
  /** Identifies the report type, e.g. "zerodha_csv" or "groww_pnl". Stored with each imported trade. */
  source: string;
}
