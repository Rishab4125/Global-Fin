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
}

export interface ParseResult {
  trades: BrokerTrade[];
  /** Human-readable reasons for rows that were ignored. */
  skipped: string[];
  error?: string;
}
