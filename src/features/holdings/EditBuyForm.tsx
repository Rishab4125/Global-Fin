"use client";

import { Field, FormError } from "@/components/fields";
import { useServerForm } from "@/components/useServerForm";
import { updateLotAction } from "./actions";

export function EditBuyForm({
  lotId,
  today,
  initial,
  minQty,
}: {
  lotId: string;
  today: string;
  initial: { buyDate: string; qty: number; price: number; fees: number };
  minQty: number;
}) {
  const { formRef, state, pending, onSubmit } = useServerForm(updateLotAction);
  return (
    <form ref={formRef} onSubmit={onSubmit} className="card space-y-5">
      <input type="hidden" name="lotId" value={lotId} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Purchase date">
          <input name="buyDate" type="date" required defaultValue={initial.buyDate} max={today} className="input" />
        </Field>
        <Field label="Quantity" hint={minQty > 0 ? `At least ${minQty} (already sold)` : undefined}>
          <input name="qty" type="number" step="any" min={minQty || 0} required defaultValue={initial.qty} className="input" />
        </Field>
        <Field label="Price per unit (₹)">
          <input name="price" type="number" step="any" min="0" required defaultValue={initial.price} className="input" />
        </Field>
        <Field label="Brokerage / fees (₹)">
          <input name="fees" type="number" step="any" min="0" defaultValue={initial.fees} className="input" />
        </Field>
      </div>
      <FormError message={state.error} />
      <button className="btn-primary" disabled={pending}>
        {pending ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
