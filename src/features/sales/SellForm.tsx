"use client";

import { useState, useTransition } from "react";
import { Field, FormError, YesNo } from "@/components/fields";
import { useServerForm } from "@/components/useServerForm";
import type { ActionState } from "@/features/portfolio/actionState";
import { formatINR, gainClass } from "@/lib/format";
import { previewSaleAction, recordSaleAction, updateSaleAction } from "./actions";

export interface SaleInitial {
  sellDate: string;
  qty: number;
  price: number;
  fees: number;
  applyTax: boolean;
  exemptRedemption: boolean;
}

export function SellForm({
  assetId,
  isSgb,
  maxQty,
  today,
  saleId,
  initial,
}: {
  assetId: string;
  isSgb: boolean;
  maxQty: number;
  today: string;
  saleId?: string;
  initial?: SaleInitial;
}) {
  const editing = !!saleId;
  const { formRef, state, pending, onSubmit } = useServerForm(editing ? updateSaleAction : recordSaleAction);
  const [preview, setPreview] = useState<ActionState>({});
  const [previewing, startPreview] = useTransition();
  const error = state.error ?? preview.error;
  const p = preview.preview;

  const doPreview = () => {
    if (!formRef.current) return;
    const data = new FormData(formRef.current);
    startPreview(async () => setPreview(await previewSaleAction({}, data)));
  };

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      onChange={() => preview.preview && setPreview({})}
      className="card space-y-5"
    >
      <input type="hidden" name="assetId" value={assetId} />
      {saleId && <input type="hidden" name="saleId" value={saleId} />}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Sale date">
          <input name="sellDate" type="date" required defaultValue={initial?.sellDate ?? today} max={today} className="input" />
        </Field>
        <Field label="Quantity" hint={`Available: ${maxQty}`}>
          <input
            name="qty"
            type="number"
            step="any"
            min="0"
            max={maxQty}
            required
            defaultValue={initial?.qty}
            className="input"
          />
        </Field>
        <Field label="Sale price per unit (₹)">
          <input name="price" type="number" step="any" min="0" required defaultValue={initial?.price} className="input" />
        </Field>
        <Field label="Brokerage / fees (₹)">
          <input name="fees" type="number" step="any" min="0" defaultValue={initial?.fees ?? 0} className="input" />
        </Field>
        <Field label="Include tax effect?">
          <YesNo name="applyTax" defaultValue={initial && !initial.applyTax ? "no" : "yes"} />
        </Field>
        {isSgb && (
          <label className="flex items-center gap-2 self-end pb-2.5 text-sm">
            <input
              type="checkbox"
              name="exemptRedemption"
              defaultChecked={initial?.exemptRedemption}
              className="size-4 accent-[var(--primary)]"
            />
            Redeemed with RBI at maturity (tax-free)
          </label>
        )}
      </div>

      <FormError message={error} />

      {p && (
        <div className="space-y-3 rounded-xl border border-primary/20 bg-primary-soft p-4 text-sm">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            <Stat label="Proceeds" value={formatINR(p.proceeds ?? 0)} />
            <Stat label="Cost (FIFO)" value={formatINR(p.cost ?? 0)} />
            <Stat label="Gain / loss" value={formatINR(p.gain)} cls={gainClass(p.gain)} />
            <Stat label={p.taxApplied ? "Estimated tax" : "Tax (not applied)"} value={formatINR(p.tax)} />
            <Stat label="Net gain" value={formatINR(p.netGain)} cls={gainClass(p.netGain)} />
          </div>
          <ul className="space-y-1 border-t border-primary/15 pt-3 text-xs text-muted">
            <li>
              Short term {formatINR(p.stcg)} · Long term {formatINR(p.ltcg)}
            </li>
            {!p.taxApplied && preview.taxIfApplied !== undefined && (
              <li className="font-medium text-accent-strong">
                Tax effect is off. With tax included it would be {formatINR(preview.taxIfApplied)}.
              </li>
            )}
            {p.taxApplied && p.exemptionUsed > 0 && (
              <li>
                {formatINR(p.exemptionUsed)} is covered by the ₹1.25L yearly equity LTCG exemption; taxable gain{" "}
                {formatINR(p.taxableGain)}.
              </li>
            )}
            {p.taxApplied && p.tax === 0 && p.gain > 0 && p.exemptionUsed === 0 && (
              <li>No tax: this asset type is tax-free or the sale is flagged exempt.</li>
            )}
            {p.taxApplied && p.tax === 0 && p.gain > 0 && p.exemptionUsed > 0 && p.taxableGain === 0 && (
              <li>
                Tax is ₹0 because the whole gain is inside the exemption
                {p.exemptionLeft !== null && ` (${formatINR(p.exemptionLeft)} still left this year)`}.
              </li>
            )}
            {p.gain <= 0 && <li>No tax on a loss.</li>}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={doPreview} className="btn-ghost" disabled={previewing}>
          {previewing ? "Calculating…" : "Preview tax"}
        </button>
        <button className="btn-primary" disabled={pending}>
          {pending ? "Saving…" : editing ? "Save changes" : "Confirm sale"}
        </button>
      </div>
    </form>
  );
}

function Stat({ label, value, cls = "" }: { label: string; value: string; cls?: string }) {
  return (
    <div>
      <div className="text-xs text-muted">{label}</div>
      <div className={`num text-base font-semibold ${cls}`}>{value}</div>
    </div>
  );
}
