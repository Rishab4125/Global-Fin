"use client";

import { useState } from "react";
import { AssetTypeSelect, Field, FormError, YesNo } from "@/components/fields";
import { useServerForm } from "@/components/useServerForm";
import { addMiscAction } from "./actions";

export function MiscForm({ today }: { today: string }) {
  const { formRef, state, pending, onSubmit } = useServerForm(addMiscAction, true);
  const [entryType, setEntryType] = useState<"general" | "buyback">("general");
  const buyback = entryType === "buyback";

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      onReset={() => setEntryType("general")}
      className="card space-y-4"
    >
      <h2 className="text-base font-semibold">Add miscellaneous profit / loss</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field
          label="Entry type"
          hint={
            buyback
              ? "From 1 Oct 2024 buyback proceeds are taxed as dividend at your slab rate. Before that they are tax-free for you."
              : undefined
          }
        >
          <select
            name="entryType"
            className="input"
            value={entryType}
            onChange={(e) => setEntryType(e.target.value as "general" | "buyback")}
          >
            <option value="general">Profit / loss</option>
            <option value="buyback">Share buyback</option>
          </select>
        </Field>
        <Field label="Investment type">
          <AssetTypeSelect name="assetType" />
        </Field>
        <Field label="Date">
          <input name="entryDate" type="date" required defaultValue={today} max={today} className="input" />
        </Field>

        {buyback ? (
          <>
            <Field label="Buyback proceeds received (₹)">
              <input name="amount" type="number" step="any" min="0" required className="input" />
            </Field>
            <Field label="Cost of shares bought back (₹)" hint="What you originally paid for those shares">
              <input name="cost" type="number" step="any" min="0" defaultValue={0} className="input" />
            </Field>
          </>
        ) : (
          <>
            <Field label="Profit or loss">
              <select name="kind" className="input" defaultValue="profit">
                <option value="profit">Profit</option>
                <option value="loss">Loss</option>
              </select>
            </Field>
            <Field label="Amount (₹)">
              <input name="amount" type="number" step="any" min="0" required className="input" />
            </Field>
          </>
        )}

        <Field label="Brokerage / charges (₹)" hint="Reduces a profit or adds to a loss">
          <input name="brokerage" type="number" step="any" min="0" defaultValue={0} className="input" />
        </Field>
        <Field label="Tax already adjusted?" hint="Yes: amount is final, no tax added. No: tax is applied on a profit.">
          <YesNo name="taxAdjusted" defaultValue="no" />
        </Field>
        <Field label={buyback ? "Holding period of the shares" : "Holding period"} hint="Only used when tax is not adjusted">
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
