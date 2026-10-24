import { formatINR, formatQty } from "@/lib/format";
import type { ImportPreview, PreviewRow } from "./view";

const STATUS: Record<PreviewRow["status"], { label: string; cls: string }> = {
  new: { label: "New", cls: "text-gain" },
  imported: { label: "Already imported", cls: "text-muted" },
  possible_duplicate: { label: "Possible duplicate", cls: "text-loss" },
  error: { label: "Can't import", cls: "text-loss" },
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
          <input type="checkbox" name="replaceEstimated" defaultChecked className="mt-1" />
          <span>
            Replace {preview.estimatedCount} estimated entr{preview.estimatedCount === 1 ? "y" : "ies"} created by
            Zerodha sync for these stocks with the real trades from this file. Keeping them would count the same
            shares twice.
          </span>
        </label>
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
                <tr key={r.key}>
                  <td className="td font-medium">{r.symbol}</td>
                  <td className="td">{r.date}</td>
                  <td className="td">{r.side === "buy" ? "Buy" : "Sell"}</td>
                  <td className="td text-right">{formatQty(r.qty)}</td>
                  <td className="td text-right">{formatINR(r.price)}</td>
                  <td className="td">
                    {r.status === "possible_duplicate" && r.tradeKey ? (
                      <label className="flex items-center gap-2 text-xs">
                        <input type="checkbox" name={`dup:${r.tradeKey}`} />
                        <span className={STATUS[r.status].cls}>Matches a trade you entered. Import anyway</span>
                      </label>
                    ) : (
                      <span className={`text-xs ${STATUS[r.status].cls}`}>
                        {sync && r.status === "new" ? "Estimated" : STATUS[r.status].label}
                        {r.message ? `: ${r.message}` : ""}
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
