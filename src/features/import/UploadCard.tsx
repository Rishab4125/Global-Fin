"use client";

import { FormError, Field } from "@/components/fields";
import { useServerForm } from "@/components/useServerForm";
import { commitImportAction, previewImportAction } from "./actions";
import { PreviewPanel } from "./PreviewPanel";

export function UploadCard() {
  const { formRef, state, pending, onSubmit, run } = useServerForm(previewImportAction);
  const preview = state.importPreview;
  const importable = preview ? preview.counts.new : 0;

  return (
    <form ref={formRef} onSubmit={onSubmit} className="card space-y-4">
      <div>
        <h2 className="text-base font-semibold">Upload trades</h2>
        <p className="mt-1 text-sm text-muted">
          Download the <strong>Tradebook</strong> CSV from Zerodha Console (Reports, Tradebook) and upload it here.
          Uploading the same file again, or an overlapping date range, never adds a trade twice.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-[12rem_1fr]">
        <Field label="Broker">
          <select name="broker" className="input" defaultValue="zerodha">
            <option value="zerodha">Zerodha (Tradebook CSV)</option>
          </select>
        </Field>
        <Field label="File">
          <input name="file" type="file" accept=".csv,text/csv" required className="input" />
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
          <button
            type="button"
            className="btn-accent"
            disabled={pending}
            onClick={() => run(commitImportAction)}
          >
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
