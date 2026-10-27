"use client";

import { Pencil } from "lucide-react";
import { AssetTypeSelect, Field, FormError } from "@/components/fields";
import { useServerForm } from "@/components/useServerForm";
import type { AssetTypeId } from "@/domain/taxRules";
import { updateAssetAction } from "./actions";

export function AssetEditor({ assetId, name, type }: { assetId: string; name: string; type: AssetTypeId }) {
  const { formRef, state, pending, onSubmit } = useServerForm(updateAssetAction);
  return (
    <details className="group card !p-0">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-3.5 text-sm font-medium [&::-webkit-details-marker]:hidden">
        <Pencil size={15} className="text-muted" />
        Rename or change investment type
      </summary>
      <form ref={formRef} onSubmit={onSubmit} className="space-y-4 border-t border-line p-5">
        <input type="hidden" name="assetId" value={assetId} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name">
            <input name="name" required autoComplete="off" maxLength={100} defaultValue={name} className="input" />
          </Field>
          <Field label="Type" hint="Changing the type changes how gains on this holding are taxed.">
            <AssetTypeSelect defaultValue={type} />
          </Field>
        </div>
        <FormError message={state.error} />
        {state.ok && <p role="status" className="text-sm text-gain">Saved.</p>}
        <button className="btn-primary" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </button>
      </form>
    </details>
  );
}
