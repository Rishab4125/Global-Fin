"use client";

import { useState } from "react";
import { Field, FormError, FormNotice } from "@/components/fields";
import { NumberField } from "@/components/NumberField";
import { PlatformField } from "@/components/PlatformField";
import { useServerForm } from "@/components/useServerForm";
import { LUMP_SUM, labelsFor, TYPE_FIELDS, typesByCategory, type FieldDef } from "@/domain/investmentFields";
import { MONEY_DECIMALS, priceDecimals, qtyDecimals } from "@/domain/limits";
import { ASSET_RULES, CATEGORIES, type AssetTypeId, type Category } from "@/domain/taxRules";
import { addBuyAction } from "./actions";

const BY_CATEGORY = typesByCategory();

export function AddBuyForm({
  today,
  platforms,
  defaultPlatform,
}: {
  today: string;
  platforms: string[];
  defaultPlatform: string;
}) {
  const { formRef, state, pending, onSubmit } = useServerForm(addBuyAction, true);
  const [category, setCategory] = useState<Category>("Stocks & ETFs");
  const [type, setType] = useState<AssetTypeId>("equity");
  // Remounting the fields clears them after a save, since the number fields keep their own text.
  const [resetKey, setResetKey] = useState(0);

  const rule = ASSET_RULES[type];
  const labels = labelsFor(type);
  const lump = LUMP_SUM.has(type);
  const fields = TYPE_FIELDS[type] ?? [];
  const required = fields.filter((f) => f.required);
  const optional = fields.filter((f) => !f.required);

  const pickCategory = (c: Category) => {
    setCategory(c);
    setType(BY_CATEGORY[c][0].id);
  };

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      onReset={() => {
        setResetKey((k) => k + 1);
        setCategory("Stocks & ETFs");
        setType("equity");
      }}
      className="card space-y-5"
    >
      <h2 className="text-base font-semibold">Add investment</h2>
      <input type="hidden" name="type" value={type} />

      <div key={resetKey} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Category">
            <select className="input" value={category} onChange={(e) => pickCategory(e.target.value as Category)}>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="Sub-type" hint={rule.note}>
            <select className="input" value={type} onChange={(e) => setType(e.target.value as AssetTypeId)}>
              {BY_CATEGORY[category].map((t) => (
                <option key={t.id} value={t.id}>
                  {t.subType}
                </option>
              ))}
            </select>
          </Field>
          <Field label={labels.name}>
            <input name="name" required autoFocus autoComplete="off" maxLength={100} placeholder={labels.namePlaceholder} className="input" />
          </Field>
          <PlatformField platforms={platforms} defaultValue={defaultPlatform} hint="Starts as the one you used last" />
          <Field label={lump ? "Start date" : "Purchase date"}>
            <input name="buyDate" type="date" required defaultValue={today} max={today} className="input" />
          </Field>
          {lump ? (
            <input type="hidden" name="qty" value="1" />
          ) : (
            <NumberField name="qty" label={labels.qty} decimals={qtyDecimals(type)} />
          )}
          <NumberField name="price" label={labels.price} decimals={priceDecimals(type)} />
          <NumberField name="fees" label="Fees (₹)" decimals={MONEY_DECIMALS} defaultValue={0} required={false} hint="Brokerage and charges, if any" />
        </div>

        {required.length > 0 && (
          <div>
            <h3 className="mb-3 text-sm font-semibold">{category} details</h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {required.map((f) => (
                <TypeField key={`${type}-${f.key}`} def={f} />
              ))}
            </div>
          </div>
        )}

        <details className="group rounded-lg border border-line">
          <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium text-muted group-open:text-ink">
            More details (optional)
          </summary>
          <div className="grid gap-4 border-t border-line p-4 sm:grid-cols-2 lg:grid-cols-3">
            {optional.map((f) => (
              <TypeField key={`${type}-${f.key}`} def={f} />
            ))}
            <Field label="Account nickname" hint="Tells two accounts apart, e.g. Dad's demat">
              <input name="nickname" maxLength={60} autoComplete="off" className="input" />
            </Field>
            <Field label="Tags" hint="Comma separated, e.g. Retirement, Kid's fund">
              <input name="tags" maxLength={300} autoComplete="off" className="input" />
            </Field>
            <div className="sm:col-span-2 lg:col-span-3">
              <Field label="Notes">
                <input name="notes" maxLength={500} autoComplete="off" className="input" />
              </Field>
            </div>
          </div>
        </details>
      </div>

      <FormError message={state.error} />
      <FormNotice message={state.ok ? "Investment added." : undefined} />
      <button className="btn-primary" disabled={pending}>
        {pending ? "Saving…" : "Save investment"}
      </button>
    </form>
  );
}

/** One type-specific field. Submitted as d:<key>. */
function TypeField({ def }: { def: FieldDef }) {
  const name = `d:${def.key}`;
  if (def.kind === "select") {
    return (
      <Field label={def.label}>
        <select name={name} required={def.required} defaultValue={def.required ? def.options?.[0] : ""} className="input">
          {!def.required && <option value="">Not set</option>}
          {def.options?.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      </Field>
    );
  }
  if (def.kind === "number") {
    return (
      <NumberField name={name} label={def.label} decimals={def.decimals ?? 2} required={def.required} placeholder={def.placeholder} hint={def.hint} />
    );
  }
  if (def.kind === "date") {
    return (
      <Field label={def.label} hint={def.hint}>
        <input name={name} type="date" required={def.required} className="input" />
      </Field>
    );
  }
  return (
    <Field label={def.label} hint={def.hint}>
      <input name={name} required={def.required} maxLength={100} autoComplete="off" placeholder={def.placeholder} className="input" />
    </Field>
  );
}
