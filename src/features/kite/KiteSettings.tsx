"use client";

import Link from "next/link";
import { useTransition } from "react";
import { disconnectKiteAction } from "./actions";

export function KiteSettings({ connected, lastSync }: { connected: boolean; lastSync: string | null }) {
  const [pending, start] = useTransition();

  return (
    <div className="space-y-3">
      {connected ? (
        <>
          <p className="text-sm">
            Zerodha is <span className="font-medium text-gain">connected</span>
            {lastSync ? <span className="text-muted">. Last synced {lastSync}.</span> : "."}
          </p>
          <p className="text-sm text-muted">
            Disconnecting deletes your saved Zerodha API key, secret and access. Trades and holdings already in the app
            stay as they are.
          </p>
          <button
            className="btn-ghost"
            disabled={pending}
            onClick={() => {
              if (confirm("Disconnect Zerodha? You can reconnect any time.")) start(() => void disconnectKiteAction());
            }}
          >
            {pending ? "Disconnecting…" : "Disconnect Zerodha"}
          </button>
        </>
      ) : (
        <p className="text-sm text-muted">
          Zerodha isn&apos;t connected. Connect it from{" "}
          <Link href="/holdings/sync" className="font-medium text-primary hover:underline">
            Sync on the Holdings page
          </Link>
          .
        </p>
      )}
    </div>
  );
}
