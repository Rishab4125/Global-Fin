"use client";

import { Field } from "@/components/fields";
import { NumberField } from "@/components/NumberField";
import type { FieldDef } from "@/domain/investmentFields";

/** One type-specific field (rate, maturity, exchange, ...). Submitted as d:<key>. `value` pre-fills it when editing. */
export function TypeField({ def, value }: { def: FieldDef; value?: string | number }) {
  const name = `d:${def.key}`;
  const text = value === undefined || value === null ? "" : String(value);
  if (def.kind === "select") {
    return (
      <Field label={def.label}>
        <select name={name} required={def.required} defaultValue={text || (def.required ? def.options?.[0] : "")} className="input">
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
      <NumberField
        name={name}
        label={def.label}
        decimals={def.decimals ?? 2}
        defaultValue={text}
        required={def.required}
        placeholder={def.placeholder}
        hint={def.hint}
      />
    );
  }
  if (def.kind === "date") {
    return (
      <Field label={def.label} hint={def.hint}>
        <input name={name} type="date" required={def.required} defaultValue={text} className="input" />
      </Field>
    );
  }
  return (
    <Field label={def.label} hint={def.hint}>
      <input name={name} required={def.required} maxLength={100} autoComplete="off" placeholder={def.placeholder} defaultValue={text} className="input" />
    </Field>
  );
}
