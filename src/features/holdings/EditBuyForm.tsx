"use client";

import { Field, FormError } from "@/components/fields";
import { NumberField } from "@/components/NumberField";
import { PlatformField } from "@/components/PlatformField";
import { useServerForm } from "@/components/useServerForm";
import { plainNumber } from "@/lib/numeric";
import { MONEY_DECIMALS, priceDecimals, qtyDecimals } from "@/domain/limits";
import type { AssetTypeId } from "@/domain/taxRules";
import { updateLotAction } from "./actions";

export function EditBuyForm({
  lotId,
  type,
  today,
  platforms,
  initial,
  minQty,
}: {
  lotId: string;
  type: AssetTypeId;
  today: string;
  platforms: string[];
  initial: { buyDate: string; qty: number; price: number; fees: number; platform: string };
  minQty: number;
}) {
  const { formRef, state, pending, onSubmit } = useServerForm(updateLotAction);
  return (
    <form ref={formRef} onSubmit={onSubmit} className="card space-y-5">
      <input type="hidden" name="lotId" value={lotId} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <PlatformField platforms={platforms.includes(initial.platform) ? platforms : [...platforms, initial.platform]} defaultValue={initial.platform} />
        <Field label="Purchase date">
          <input name="buyDate" type="date" required defaultValue={initial.buyDate} max={today} className="input" />
        </Field>
        <NumberField
          name="qty"
          label="Quantity"
          decimals={qtyDecimals(type)}
          defaultValue={plainNumber(initial.qty)}
          hint={minQty > 0 ? `At least ${minQty} (already sold)` : undefined}
        />
        <NumberField name="price" label="Price per unit (₹)" decimals={priceDecimals(type)} defaultValue={plainNumber(initial.price)} />
        <NumberField name="fees" label="Fees (₹)" decimals={MONEY_DECIMALS} defaultValue={plainNumber(initial.fees)} required={false} />
      </div>
      <FormError message={state.error} />
      <button className="btn-primary" disabled={pending}>
        {pending ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
