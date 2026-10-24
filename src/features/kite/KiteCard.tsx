"use client";

import { FormError } from "@/components/fields";
import { useServerForm } from "@/components/useServerForm";
import { PreviewPanel } from "@/features/import/PreviewPanel";
import { commitSyncAction, previewSyncAction } from "./actions";

const RECONNECT_NOTE =
  "Zerodha signs you out every morning, so please reconnect. It takes one tap and your Zerodha login.";

export function KiteCard({
  hasConnection,
  connected,
  lastSync,
  flash,
}: {
  hasConnection: boolean;
  connected: boolean;
  lastSync: string | null;
  flash: string | null;
}) {
  const { formRef, state, pending, onSubmit, run } = useServerForm(previewSyncAction);
  const preview = state.importPreview;

  return (
    <form ref={formRef} onSubmit={onSubmit} className="card space-y-4">
      <div>
        <h2 className="text-base font-semibold">Zerodha</h2>
        <p className="mt-1 text-sm text-muted">
          Compares your Zerodha holdings with this app and fills in the difference: extra shares become a buy at
          Zerodha&apos;s average price, missing shares become a sale at the last price. Both are marked estimated.
          To disconnect Zerodha, go to Settings.
        </p>
      </div>

      {hasConnection && !connected && <FormError message={RECONNECT_NOTE} />}
      {flash === "connected" && <p className="rounded-lg bg-primary-soft px-3 py-2 text-sm">Zerodha connected.</p>}
      {flash === "error" && <FormError message="Couldn't connect to Zerodha. Please try again." />}
      <FormError message={state.error} />
      {state.importDone && (
        <p className="rounded-lg bg-primary-soft px-3 py-2 text-sm">
          Synced: added {state.importDone.buys} buy{state.importDone.buys === 1 ? "" : "s"}, recorded{" "}
          {state.importDone.sells} sale{state.importDone.sells === 1 ? "" : "s"}.
        </p>
      )}

      {connected && lastSync && <p className="text-xs text-muted">Last synced {lastSync}</p>}
      {preview && <PreviewPanel preview={preview} mode="sync" />}

      <div className="flex flex-wrap gap-2">
        {!connected && (
          <a href="/api/kite/login" className="btn-primary">
            {hasConnection ? "Reconnect Zerodha" : "Connect Zerodha"}
          </a>
        )}
        {connected && (
          <button className="btn-primary" disabled={pending}>
            {pending ? "Working…" : preview ? "Refresh" : "Sync holdings"}
          </button>
        )}
        {preview && preview.counts.new > 0 && (
          <button type="button" className="btn-accent" disabled={pending} onClick={() => run(commitSyncAction)}>
            Confirm sync
          </button>
        )}
      </div>
    </form>
  );
}
