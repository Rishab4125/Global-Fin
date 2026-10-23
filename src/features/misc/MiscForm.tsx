"use client";

import { AssetTypeSelect, Field, FormError, YesNo } from "@/components/fields";
import { useServerForm } from "@/components/useServerForm";
import { addMiscAction } from "./actions";

export function MiscForm({ today }: { today: string }) {
  const { formRef, state, pending, onSubmit } = useServerForm(addMiscAction, true);

  return (
    <form ref={formRef} onSubmit={onSubmit} className="card space-y-4">
      <h2 className="text-base font-semibold">Add miscellaneous profit / loss</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Investment type">
          <AssetTypeSelect name="assetType" />
        </Field>
        <Field label="Date">
          <input name="entryDate" type="date" required defaultValue={today} max={today} className="input" />
        </Field>
        <Field label="Profit or loss">
          <select name="kind" className="input" defaultValue="profit">
            <option value="profit">Profit</option>
            <option value="loss">Loss</option>
          </select>
        </Field>
        <Field label="Amount (₹)">
          <input name="amount" type="number" step="any" min="0" required className="input" />
        </Field>
        <Field label="Tax already adjusted?" hint="Yes: amount is final, no tax added. No: tax is applied on a profit.">
          <YesNo name="taxAdjusted" defaultValue="no" />
        </Field>
        <Field label="Holding period" hint="Only used when tax is not adjusted">
          <select name="term" className="input" defaultValue="STCG">
            <option value="STCG">Short term</option>
            <option value="LTCG">Long term</option>
          </select>
        </Field>
        <div className="sm:col-span-2 lg:col-span-3">
          <Field label="Note (optional)">
            <input name="note" maxLength={200} className="input" />
          </Field>
        </div>
      </div>
      <FormError message={state.error} />
      <button className="btn-primary" disabled={pending}>
        {pending ? "Saving…" : "Save entry"}
      </button>
    </form>
  );
}
