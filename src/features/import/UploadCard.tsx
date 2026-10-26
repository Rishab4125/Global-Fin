"use client";

import { useState } from "react";
import { FormError, Field } from "@/components/fields";
import { useServerForm } from "@/components/useServerForm";
import { commitImportAction, previewImportAction } from "./actions";
import { PreviewPanel } from "./PreviewPanel";

const HELP: Record<string, string> = {
  zerodha: "Upload the P&L report from Console (Reports > P&L). The Tax P&L is not accepted.",
  groww: "Upload your stock Order history or your stock Profit & Loss report.",
};

export function UploadCard() {
  const { formRef, state, pending, onSubmit, run } = useServerForm(previewImportAction);
  const [broker, setBroker] = useState("zerodha");
  const preview = state.importPreview;
  const importable = preview ? preview.counts.new : 0;

  return (
    <form ref={formRef} onSubmit={onSubmit} className="card space-y-4">
      <div>
        <h2 className="text-base font-semibold">Upload trades</h2>
        <p className="mt-1 text-sm text-muted">
          {HELP[broker]} CSV and Excel (.xlsx) files both work. Uploading the same file again, or an overlapping date
          range, never adds a trade twice. For Groww, importing both the Order history and the P&amp;L report for the same
          period will flag the trades that match.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-[12rem_1fr]">
        <Field label="Broker">
          <select name="broker" className="input" value={broker} onChange={(e) => setBroker(e.target.value)}>
            <option value="zerodha">Zerodha</option>
            <option value="groww">Groww</option>
          </select>
        </Field>
        <Field label="File">
          <input
            name="file"
            type="file"
            accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            required
            className="input"
          />
        </Field>
      </div>

      <FormError message={state.error} />
      {state.importDone && (
        <p className="rounded-lg bg-primary-soft px-3 py-2 text-sm">
          Imported {state.importDone.buys} buy{state.importDone.buys === 1 ? "" : "s"} and {state.importDone.sells}{" "}
          sell{state.importDone.sells === 1 ? "" : "s"}. Skipped {state.importDone.skipped} already-known trade
          {state.importDone.skipped === 1 ? "" : "s"}
          {state.importDone.failed ? `; ${state.importDone.failed} could not be imported` : ""}.
        </p>
      )}

      {preview && <PreviewPanel preview={preview} mode="upload" />}

      <div className="flex flex-wrap gap-2">
        <button className="btn-primary" disabled={pending}>
          {pending ? "Working…" : preview ? "Refresh preview" : "Preview"}
        </button>
        {preview && (
          <button type="button" className="btn-accent" disabled={pending} onClick={() => run(commitImportAction)}>
            Import
          </button>
        )}
      </div>
      {preview && importable === 0 && preview.counts.possible === 0 && (
        <p className="text-xs text-muted">Nothing new to import from this file.</p>
      )}
    </form>
  );
}
