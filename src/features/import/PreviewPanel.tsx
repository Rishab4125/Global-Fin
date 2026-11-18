"use client";

import { useState } from "react";
import { formatDate, formatINR, formatQty } from "@/lib/format";
import type { ImportPreview, PreviewRow } from "./view";

const STATUS: Record<PreviewRow["status"], { label: string; cls: string }> = {
  new: { label: "New", cls: "badge-gain" },
  imported: { label: "Already present", cls: "badge-muted" },
  possible_duplicate: { label: "Possible duplicate", cls: "badge-warn" },
  overlap: { label: "Overlaps earlier P&L", cls: "badge-warn" },
  error: { label: "Can't import", cls: "badge-loss" },
};

const KIND_LABEL = {
  isin: "Matched by ISIN",
  mapped: "Your choice",
  name: "Matched by name",
  suggest: "Suggested match: please check",
  none: "New holding",
} as const;

export function PreviewPanel({ preview, mode }: { preview: ImportPreview; mode: "upload" | "sync" }) {
  const { counts } = preview;
  const adjustable = preview.matches.filter((m) => m.kind !== "isin");
  const sync = mode === "sync";
  // Status chips only hide rows (they stay in the form), so a hidden "Import anyway" tick is still submitted.
  const [shown, setShown] = useState<PreviewRow["status"][]>([]);
  const toggleStatus = (s: PreviewRow["status"]) =>
    setShown((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));
  const statusCount = (s: PreviewRow["status"]) => preview.rows.filter((r) => r.status === s).length;
  const statuses = (Object.keys(STATUS) as PreviewRow["status"][]).filter(statusCount);

  // Ticked rows. Starts from the server's choice (new rows ticked, already-present rows not) and resets on a new preview.
  const initial = (p: ImportPreview) => new Set(p.rows.filter((r) => r.include).map((r) => r.key));
  const [seenPreview, setSeenPreview] = useState(preview);
  const [ticked, setTicked] = useState(() => initial(preview));
  if (seenPreview !== preview) {
    setSeenPreview(preview);
    setTicked(initial(preview));
  }
  const selectable = preview.rows.filter((r) => r.selectable);
  const toggleRow = (key: string) =>
    setTicked((cur) => {
      const next = new Set(cur);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  const pick = (f: (r: PreviewRow) => boolean) => setTicked(new Set(selectable.filter(f).map((r) => r.key)));
  const pickedCount = selectable.filter((r) => ticked.has(r.key)).length;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        {sync
          ? counts.new
            ? `${counts.new} change${counts.new === 1 ? "" : "s"} to bring the app in line with Zerodha.`
            : "Your holdings already match Zerodha. Nothing to change."
          : `${counts.new} new, ${counts.imported + counts.overlap} already present, ${counts.possible} possible duplicate${
              counts.possible === 1 ? "" : "s"
            }${counts.error ? `, ${counts.error} can't be imported` : ""}. ${pickedCount} selected to import.`}
      </p>
      {!sync && selectable.length > 0 && (
        <div className="flex flex-wrap gap-3 text-[13px]">
          <button type="button" className="text-primary-strong hover:underline" onClick={() => pick((r) => r.status === "new")}>
            New only
          </button>
          <button type="button" className="text-muted hover:text-ink" onClick={() => pick(() => true)}>
            Select all
          </button>
          <button type="button" className="text-muted hover:text-ink" onClick={() => pick(() => false)}>
            Select none
          </button>
        </div>
      )}

      {adjustable.length > 0 && (
        <div className="rounded-xl border border-line p-3">
          <p className="mb-2 text-sm font-medium">Which holding does each stock belong to?</p>
          <p className="mb-3 text-xs text-muted">
            This stops the same stock from being added twice. Pick an existing holding if one already covers it.
          </p>
          <div className="space-y-2">
            {adjustable.map((m) => (
              <div key={m.key} className="grid items-center gap-2 sm:grid-cols-[1fr_1.5fr]">
                <div>
                  <span className="font-medium">{m.symbol}</span>
                  <span className="ml-2 text-xs text-muted">{KIND_LABEL[m.kind]}</span>
                </div>
                <select name={`map:${m.key}`} defaultValue={m.assetId ?? "new"} className="input">
                  <option value="new">Create new holding &quot;{m.symbol}&quot;</option>
                  {preview.assetOptions.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      {!sync && preview.estimatedCount > 0 && (
        <label className="flex items-start gap-2 rounded-xl border border-line p-3 text-sm">
          <input type="checkbox" name="replaceEstimated" defaultChecked className="mt-1 accent-[var(--primary)]" />
          <span>
            Replace {preview.estimatedCount} estimated entr{preview.estimatedCount === 1 ? "y" : "ies"} created by
            Zerodha sync for these stocks with the real trades from this file. Keeping them would count the same
            shares twice.
          </span>
        </label>
      )}

      {!sync && preview.reconciledCount > 0 && (
        <p className="rounded-xl border border-line p-3 text-sm">
          Replacing {preview.reconciledCount} &quot;still held&quot; entr{preview.reconciledCount === 1 ? "y" : "ies"} from
          your earlier P&amp;L with the holdings in this report, so the same shares are not counted twice.
        </p>
      )}

      {!sync && preview.replacedCount > 0 && (
        <p className="rounded-xl border border-line p-3 text-sm">
          This report&apos;s period contains an earlier P&amp;L you imported. Replacing its {preview.replacedCount} entr
          {preview.replacedCount === 1 ? "y" : "ies"} with this report, so the same trades are not counted twice.
        </p>
      )}

      {!sync && statuses.length > 1 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by status">
          {statuses.map((s) => {
            const on = shown.includes(s);
            return (
              <button
                key={s}
                type="button"
                aria-pressed={on}
                onClick={() => toggleStatus(s)}
                className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium transition ${
                  on ? "border-primary/40 bg-primary-soft text-primary-strong" : "border-line bg-surface text-muted hover:text-ink"
                }`}
              >
                {STATUS[s].label}
                <b className="font-semibold">{statusCount(s)}</b>
              </button>
            );
          })}
          {shown.length > 0 && (
            <button type="button" onClick={() => setShown([])} className="text-[13px] text-muted hover:text-ink">
              Show all
            </button>
          )}
        </div>
      )}

      {preview.rows.length > 0 && (
        <ul className="grid gap-2">
          {preview.rows.map((r) => {
            const on = ticked.has(r.key);
            const hide = shown.length > 0 && !shown.includes(r.status);
            const cols = sync
              ? "grid-cols-1 md:grid-cols-[minmax(9rem,1fr)_minmax(9rem,.8fr)_2fr]"
              : "grid-cols-[auto_1fr] md:grid-cols-[auto_minmax(9rem,1fr)_minmax(9rem,.8fr)_2fr]";
            return (
              // Hidden cards stay in the form (display:none), so their ticks are still submitted.
              <li key={r.key} className={hide ? "hidden" : ""}>
                <label
                  className={`grid ${cols} items-start gap-x-3 gap-y-1.5 rounded-xl border p-3 md:items-center ${
                    !sync && on ? "border-primary/45 bg-primary-soft" : "border-line bg-surface"
                  } ${!sync && !r.selectable ? "opacity-75" : sync ? "" : "cursor-pointer"}`}
                >
                  {!sync && (
                    <span className="pt-0.5 md:pt-0">
                      {r.tradeKey && <input type="hidden" name={`row:${r.tradeKey}`} value="1" />}
                      {r.selectable && r.tradeKey ? (
                        <input
                          type="checkbox"
                          name={`sel:${r.tradeKey}`}
                          checked={on}
                          onChange={() => toggleRow(r.key)}
                          aria-label={`Import ${r.symbol} ${r.side} on ${r.date}`}
                          className="size-4 accent-[var(--primary)]"
                        />
                      ) : (
                        <input type="checkbox" disabled aria-label="Cannot be imported" className="size-4 opacity-40" />
                      )}
                    </span>
                  )}
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-x-2">
                      <span className="font-medium">{r.symbol}</span>
                      <span className={r.side === "buy" ? "badge-gain" : "badge-warn"}>{r.side === "buy" ? "Buy" : "Sell"}</span>
                    </span>
                    <span className="block text-xs text-muted">{formatDate(r.date)}</span>
                  </span>
                  <span className={`flex items-baseline justify-between gap-3 md:block ${sync ? "" : "col-start-2 md:col-start-auto"}`}>
                    <span className="text-sm">
                      {formatQty(r.qty)} × {formatINR(r.price)}
                    </span>
                    <span className="block text-xs text-muted">{formatINR(r.qty * r.price)}</span>
                  </span>
                  <span className={`flex flex-wrap items-center gap-x-2 gap-y-1 ${sync ? "" : "col-start-2 md:col-start-auto"}`}>
                    <span className={STATUS[r.status].cls}>
                      {sync && r.status === "new" ? "Estimated" : STATUS[r.status].label}
                    </span>
                    {r.message && <span className="whitespace-normal text-xs text-muted">{r.message}</span>}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      )}

      {preview.skipped.length > 0 && (
        <details className="text-xs text-muted">
          <summary className="cursor-pointer">{preview.skipped.length} rows ignored</summary>
          <ul className="mt-1 list-disc pl-5">
            {preview.skipped.slice(0, 50).map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
