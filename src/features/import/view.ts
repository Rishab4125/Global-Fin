import type { MatchKind, Plan, PlanAsset, PlanRowStatus } from "./plan";

export interface PreviewRow {
  key: string;
  /** Present for rows that can be individually opted in (possible duplicates). */
  tradeKey: string | null;
  symbol: string;
  date: string;
  side: "buy" | "sell";
  qty: number;
  price: number;
  status: PlanRowStatus;
  message?: string;
  /** Ticked in the preview. */
  include: boolean;
  /** The row has a checkbox the user can change. */
  selectable: boolean;
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
  reconciledCount: number;
  replacedCount: number;
  counts: { new: number; imported: number; possible: number; overlap: number; error: number; selected: number };
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
    include: r.include,
    selectable: r.selectable,
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
    reconciledCount: plan.reconciledCount,
    replacedCount: plan.replacedCount,
    counts: {
      new: count((r) => r.status === "new"),
      imported: count((r) => r.status === "imported"),
      possible: count((r) => r.status === "possible_duplicate"),
      overlap: count((r) => r.status === "overlap"),
      error: count((r) => r.status === "error"),
      selected: count((r) => r.include),
    },
  };
}
