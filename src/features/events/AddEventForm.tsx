"use client";

import { useState } from "react";
import { Field, FormError, FormNotice } from "@/components/fields";
import { useServerForm } from "@/components/useServerForm";
import type { ActionType } from "@/domain/corporateActions";
import { addEventAction } from "./actions";

const LABEL: Record<ActionType, string> = { split: "Split / consolidation", bonus: "Bonus issue", dividend: "Dividend" };

export function AddEventForm({ assetId, today, types }: { assetId: string; today: string; types: ActionType[] }) {
  const { formRef, state, pending, onSubmit } = useServerForm(addEventAction, true);
  const [type, setType] = useState<ActionType>(types[0]);
  const [newQty, setNewQty] = useState("5");
  const [oldQty, setOldQty] = useState("1");

  const n = Number(newQty);
  const o = Number(oldQty);
  const example =
    type === "split" && n > 0 && o > 0
      ? `Example: 10 shares at ₹1,000 become ${(10 * n) / o} shares at ₹${(1000 * o) / n}. Total cost and the buy date stay the same.`
      : type === "bonus" && n > 0 && o > 0
        ? `Example: 10 shares earn ${Math.floor((10 * n) / o)} bonus shares at no cost. Their holding period starts on the bonus date.`
        : undefined;

  return (
    <form ref={formRef} onSubmit={onSubmit} onReset={() => setType(types[0])} className="space-y-4 border-t border-line p-5">
      <input type="hidden" name="assetId" value={assetId} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Event">
          <select name="type" className="input" value={type} onChange={(e) => setType(e.target.value as ActionType)}>
            {types.map((t) => (
              <option key={t} value={t}>
                {LABEL[t]}
              </option>
            ))}
          </select>
        </Field>
        <Field label={type === "split" ? "Effective date" : type === "bonus" ? "Bonus date" : "Payment date"}>
          <input name="date" type="date" required defaultValue={today} max={today} className="input" />
        </Field>
        {type !== "dividend" ? (
          <>
            <Field label="New shares" hint={type === "split" ? "Each old share becomes this many" : "Bonus shares given"}>
              <input name="ratioNew" type="number" min="1" step="1" required value={newQty} onChange={(e) => setNewQty(e.target.value)} className="input" />
            </Field>
            <Field label="For every (old shares)" hint={type === "split" ? "Usually 1" : "Shares you hold"}>
              <input name="ratioOld" type="number" min="1" step="1" required value={oldQty} onChange={(e) => setOldQty(e.target.value)} className="input" />
            </Field>
          </>
        ) : (
          <>
            <Field label="Dividend received (₹)">
              <input name="amount" type="number" step="any" min="0" required className="input" />
            </Field>
            <Field label="TDS deducted (₹)" hint="Optional, for your records">
              <input name="tds" type="number" step="any" min="0" defaultValue={0} className="input" />
            </Field>
          </>
        )}
      </div>
      {example && <p className="text-xs text-muted">{example}</p>}
      {type === "dividend" && (
        <p className="text-xs text-muted">Dividends are taxed at your slab rate. TDS above ₹5,000 a year is 10%.</p>
      )}
      <FormError message={state.error} />
      <FormNotice message={state.ok ? "Event saved." : undefined} />
      <button className="btn-primary" disabled={pending}>
        {pending ? "Saving…" : "Add event"}
      </button>
    </form>
  );
}
