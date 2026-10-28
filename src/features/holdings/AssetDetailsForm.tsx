"use client";

import { Field, FormError, FormNotice } from "@/components/fields";
import { useServerForm } from "@/components/useServerForm";
import { TYPE_FIELDS } from "@/domain/investmentFields";
import type { AssetTypeId } from "@/domain/taxRules";
import { updateAssetDetailsAction } from "./actions";
import { TypeField } from "./TypeFields";

/** Fill in or change the details of a holding after it was added: type-specific fields, tags, notes and nickname. */
export function AssetDetailsForm({
  assetId,
  type,
  isin,
  details,
  tags,
  notes,
}: {
  assetId: string;
  type: AssetTypeId;
  isin: string | null;
  details: Record<string, unknown>;
  tags: string[];
  notes: string;
}) {
  const { formRef, state, pending, onSubmit } = useServerForm(updateAssetDetailsAction);
  const fields = TYPE_FIELDS[type] ?? [];
  const valueOf = (key: string) => (key === "isin" ? (isin ?? "") : (details[key] as string | number | undefined));

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-4">
      <input type="hidden" name="assetId" value={assetId} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {fields.map((f) => (
          <TypeField key={f.key} def={f} value={valueOf(f.key)} />
        ))}
        <Field label="Account nickname" hint="Tells two accounts apart, e.g. Dad's demat">
          <input name="nickname" maxLength={60} autoComplete="off" defaultValue={String(details.nickname ?? "")} className="input" />
        </Field>
        <Field label="Tags" hint="Comma separated, e.g. Retirement, Kid's fund">
          <input name="tags" maxLength={300} autoComplete="off" defaultValue={tags.join(", ")} className="input" />
        </Field>
        <div className="sm:col-span-2 lg:col-span-3">
          <Field label="Notes">
            <input name="notes" maxLength={500} autoComplete="off" defaultValue={notes} className="input" />
          </Field>
        </div>
      </div>
      <FormError message={state.error} />
      <FormNotice message={state.ok ? "Saved." : undefined} />
      <button className="btn-primary" disabled={pending}>
        {pending ? "Saving…" : "Save details"}
      </button>
    </form>
  );
}
