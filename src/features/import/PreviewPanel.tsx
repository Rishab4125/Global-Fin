"use client";

import { useState } from "react";
import { formatDate, formatINR, formatQty } from "@/lib/format";
import type { ImportPreview, PreviewRow } from "./view";

const STATUS: Record<PreviewRow["status"], { label: string; cls: string }> = {
  new: { label: "New", cls: "badge-gain" },
  imported: { label: "Already imported", cls: "badge-muted" },
  possible_duplicate: { label: "Possible duplicate", cls: "badge-warn" },
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

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        {sync
          ? counts.new
            ? `${counts.new} change${counts.new === 1 ? "" : "s"} to bring the app in line with Zerodha.`
            : "Your holdings already match Zerodha. Nothing to change."
          : `${counts.new} new, ${counts.imported} already imported, ${counts.possible} possible duplicate${
              counts.possible === 1 ? "" : "s"
            }${counts.error ? `, ${counts.error} can't be imported` : ""}.`}
      </p>

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
        <div className="max-h-96 overflow-auto rounded-xl border border-line">
          <table className="w-full">
            <thead className="sticky top-0 bg-surface">
              <tr>
                <th className="th">Stock</th>
                <th className="th">Date</th>
                <th className="th">Type</th>
                <th className="th text-right">Qty</th>
                <th className="th text-right">Price</th>
                <th className="th">Status</th>
              </tr>
            </thead>
            <tbody>
              {preview.rows.map((r) => (
                <tr key={r.key} hidden={shown.length > 0 && !shown.includes(r.status)}>
                  <td className="td font-medium">{r.symbol}</td>
                  <td className="td">{formatDate(r.date)}</td>
                  <td className="td">{r.side === "buy" ? "Buy" : "Sell"}</td>
                  <td className="td text-right">{formatQty(r.qty)}</td>
                  <td className="td text-right">{formatINR(r.price)}</td>
                  <td className="td">
                    {r.status === "possible_duplicate" && r.tradeKey ? (
                      <label className="flex items-center gap-2 text-xs">
                        <input type="checkbox" name={`dup:${r.tradeKey}`} className="accent-[var(--primary)]" />
                        <span className="text-accent-strong">Same stock, day and quantity as an existing entry. Import anyway</span>
                      </label>
                    ) : (
                      <span className="inline-flex flex-wrap items-center gap-2">
                        <span className={STATUS[r.status].cls}>
                          {sync && r.status === "new" ? "Estimated" : STATUS[r.status].label}
                        </span>
                        {r.message && <span className="whitespace-normal text-xs text-muted">{r.message}</span>}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
