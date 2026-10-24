"use client";

import { useActionState } from "react";
import { Field, FormError } from "@/components/fields";
import type { ActionState } from "@/features/portfolio/actionState";
import { saveKiteCredentialsAction } from "./actions";

export function KiteSetup({ callbackUrl, configured }: { callbackUrl: string; configured: boolean }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveKiteCredentialsAction, {});

  return (
    <form action={action} className="card space-y-4">
      <div>
        <h2 className="text-base font-semibold">Connect your Zerodha account</h2>
        <p className="mt-1 text-sm text-muted">
          Zerodha gives each person a free personal API key. Create yours once, then paste it here.
        </p>
      </div>

      <ol className="list-decimal space-y-2 pl-5 text-sm">
        <li>
          Log in at <span className="font-medium">developers.kite.trade</span> with your Zerodha account and create a
          new app of type <span className="font-medium">Personal</span> (free). The app name can be anything.
        </li>
        <li>
          Set the <span className="font-medium">Redirect URL</span> to exactly:
          <code className="mt-1 block break-all rounded-lg bg-surface2 px-3 py-2 text-xs">{callbackUrl}</code>
          Leave the Postback URL empty.
        </li>
        <li>Copy the API key and API secret from the app and paste them below.</li>
      </ol>

      {!configured && <FormError message="Zerodha sync isn't set up on this server yet." />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="API key">
          <input name="apiKey" required autoComplete="off" className="input" />
        </Field>
        <Field label="API secret">
          <input name="apiSecret" type="password" required autoComplete="off" className="input" />
        </Field>
      </div>
      <p className="text-xs text-muted">
        Your secret is stored encrypted and is only used to read your holdings. Disconnecting in Settings deletes it.
      </p>
      <FormError message={state.error} />
      <button className="btn-primary" disabled={pending || !configured}>
        {pending ? "Saving…" : "Save and connect Zerodha"}
      </button>
    </form>
  );
}
