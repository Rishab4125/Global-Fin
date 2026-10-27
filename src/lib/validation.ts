import { z } from "zod";
import { todayIso } from "@/domain/dates";

const blank = (v: unknown) => (v === "" || v === null || v === undefined ? undefined : v);

/** A real calendar day (rejects 2025-02-31) that is not in the future. */
export const pastDate = z
  .string({ error: "Pick a date" })
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a valid date")
  .refine((s) => {
    const d = new Date(`${s}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
  }, "Pick a valid date")
  .refine((s) => s <= todayIso(), "Date can't be in the future");

/** A finite number from a form field; `label` is a lowercase noun such as "price". An empty field is an error, not 0. */
export function number(label: string, opts: { min?: number; max?: number } = {}) {
  const { min = 0, max = 1e12 } = opts;
  const cap = label.charAt(0).toUpperCase() + label.slice(1);
  return z.preprocess(
    blank,
    z.coerce
      .number({ error: `Enter a valid ${label}` })
      .refine(Number.isFinite, `Enter a valid ${label}`)
      .refine((n) => n >= min, min > 0 ? `${cap} must be more than zero` : `${cap} can't be negative`)
      .refine((n) => n <= max, `${cap} is too large`),
  );
}

/** Smallest quantity the database can store (4 decimal places). */
export const qty = (label = "quantity") => number(label, { min: 0.0001, max: 1e10 });
