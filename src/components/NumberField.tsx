"use client";

import { useState } from "react";
import { decimalsError } from "@/lib/numeric";

/**
 * A number input that accepts pasted amounts ("₹1,25,000.50" becomes 125000.50) and says "Up to 2 decimals" as the
 * user types, instead of rounding silently. The server checks the same rule, so this is only early feedback.
 */
export function NumberField({
  name,
  decimals,
  defaultValue = "",
  required = true,
  placeholder,
  label,
  hint,
}: {
  name: string;
  /** Most decimals allowed. 0 means whole numbers only. */
  decimals: number;
  defaultValue?: string | number;
  required?: boolean;
  placeholder?: string;
  label: string;
  hint?: string;
}) {
  const [value, setValue] = useState(String(defaultValue));
  const error = decimalsError(value, decimals);
  const hintId = `${name}-hint`;

  return (
    <label className="block">
      <span className="label">{label}</span>
      <input
        name={name}
        type="text"
        inputMode={decimals === 0 ? "numeric" : "decimal"}
        autoComplete="off"
        required={required}
        placeholder={placeholder}
        value={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={hintId}
        onChange={(e) => setValue(e.target.value.replace(/[₹,\s]/g, ""))}
        className={`input ${error ? "!border-loss" : ""}`}
      />
      <span id={hintId} role={error ? "alert" : undefined} className={`mt-1.5 block text-xs ${error ? "text-loss" : "text-muted"}`}>
        {error || hint || (decimals === 0 ? "Whole units only" : `Up to ${decimals} decimals`)}
      </span>
    </label>
  );
}
