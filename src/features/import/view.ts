import type { RowStatus } from "@/domain/brokerSync";
import type { MatchKind, Plan, PlanAsset } from "./plan";

export interface PreviewRow {
  key: string;
  /** Present for rows that can be individually opted in (possible duplicates). */
  tradeKey: string | null;
  symbol: string;
  date: string;
  side: "buy" | "sell";
  qty: number;
  price: number;
  status: RowStatus | "error";
  message?: string;
}

export interface PreviewMatch {
  key: string;
  symbol: string;
  isin: string | null;
  kind: MatchKind;
  assetId: string | null;
}

export interface ImportPreview {
  mode: "upload" | "sync";
  rows: PreviewRow[];
  matches: PreviewMatch[];
  assetOptions: { id: string; name: string }[];
  skipped: string[];
  estimatedCount: number;
  counts: { new: number; imported: number; possible: number; error: number };
}

export interface ImportDone {
  buys: number;
  sells: number;
  skipped: number;
  failed: number;
}

export function toPreview(
  mode: ImportPreview["mode"],
  plan: Plan,
  assets: PlanAsset[],
  skipped: string[],
): ImportPreview {
  const rows: PreviewRow[] = plan.rows.map((r, i) => ({
    key: r.tradeKey ?? `row-${i}`,
    tradeKey: r.tradeKey,
    symbol: r.trade.symbol,
    date: r.trade.date,
    side: r.trade.side,
    qty: r.trade.qty,
    price: r.trade.price,
    status: r.status,
    message: r.message,
  }));
  const count = (f: (r: PreviewRow) => boolean) => rows.filter(f).length;
  return {
    mode,
    rows,
    matches: plan.matches.map((m) => ({
      key: m.key,
      symbol: m.symbol,
      isin: m.isin,
      kind: m.kind,
      assetId: m.assetId,
    })),
    assetOptions: assets.map((a) => ({ id: a.id, name: a.name })).sort((a, b) => a.name.localeCompare(b.name)),
    skipped,
    estimatedCount: plan.estimatedCount,
    counts: {
      new: count((r) => r.status === "new"),
      imported: count((r) => r.status === "imported"),
      possible: count((r) => r.status === "possible_duplicate"),
      error: count((r) => r.status === "error"),
    },
  };
}
