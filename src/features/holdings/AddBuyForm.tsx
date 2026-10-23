"use client";

import { useState } from "react";
import { AssetTypeSelect, Field, FormError } from "@/components/fields";
import { ASSET_RULES, type AssetTypeId } from "@/domain/taxRules";
import { useServerForm } from "@/components/useServerForm";
import { addBuyAction } from "./actions";

export function AddBuyForm({ today }: { today: string }) {
  const { formRef, state, pending, onSubmit } = useServerForm(addBuyAction, true);
  const [type, setType] = useState<AssetTypeId>("equity");

  return (
    <form ref={formRef} onSubmit={onSubmit} className="card space-y-4">
      <h2 className="text-base font-semibold">Add investment</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Type" hint={ASSET_RULES[type].note}>
          <AssetTypeSelect onChange={setType} />
        </Field>
        <Field label="Name / symbol">
          <input name="name" required placeholder="e.g. RELIANCE, HDFC FD, Plot 12" className="input" />
        </Field>
        <Field label="Purchase date">
          <input name="buyDate" type="date" required defaultValue={today} max={today} className="input" />
        </Field>
        <Field label="Quantity" hint="Use 1 for land, FD or lump sums">
          <input name="qty" type="number" step="any" min="0" required className="input" />
        </Field>
        <Field label="Price per unit (₹)">
          <input name="price" type="number" step="any" min="0" required className="input" />
        </Field>
        <Field label="Brokerage / fees (₹)">
          <input name="fees" type="number" step="any" min="0" defaultValue={0} className="input" />
        </Field>
      </div>
      <FormError message={state.error} />
      <button className="btn-primary" disabled={pending}>
        {pending ? "Saving…" : "Save investment"}
      </button>
    </form>
  );
}
