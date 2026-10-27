"use client";

import { useActionState } from "react";
import { Field, FormError } from "@/components/fields";
import type { ActionState } from "@/features/portfolio/actionState";
import { saveSlabAction } from "./actions";

export function SlabForm({ slabPercent }: { slabPercent: number }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveSlabAction, {});
  return (
    <form action={action} className="card max-w-md space-y-4">
      <h2 className="text-base font-semibold">Your income-tax slab rate</h2>
      <Field label="Slab rate (%)" hint="Used for short-term gains on debt, gold, land, FD interest, etc.">
        <input
          name="slabPercent"
          type="number"
          step="any"
          min="0"
          max="45"
          defaultValue={slabPercent}
          className="input"
        />
      </Field>
      <FormError message={state.error} />
      {state.ok && <p role="status" className="text-sm text-gain">Saved.</p>}
      <button className="btn-primary" disabled={pending}>
        {pending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
