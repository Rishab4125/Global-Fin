import { z } from "zod";
import { todayIso } from "../domain/dates";
import { decimalsMessage, MONEY_DECIMALS, placesOf } from "../domain/limits";

const blank = (v: unknown) => (v === "" || v === null || v === undefined ? undefined : v);

/** "₹1,25,000.50" -> "125000.50". Pasted amounts often carry the symbol, commas or spaces. */
export const cleanNumeric = (v: unknown) => (typeof v === "string" ? v.replace(/[₹,\s]/g, "") : v);

/** A real calendar day (rejects 2025-02-31) that is not in the future. */
export const pastDate = z
  .string({ error: "Pick a date" })
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a valid date")
  .refine((s) => {
    const d = new Date(`${s}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
  }, "Pick a valid date")
  .refine((s) => s <= todayIso(), "Date can't be in the future");

/**
 * A finite number from a form field; `label` is a lowercase noun such as "price". An empty field is an error, not 0.
 * Pasted symbols and commas are stripped. With `decimals`, extra digits are rejected ("Up to 2 decimals"), never rounded.
 */
export function number(label: string, opts: { min?: number; max?: number; decimals?: number } = {}) {
  const { min = 0, max = 1e12, decimals } = opts;
  const cap = label.charAt(0).toUpperCase() + label.slice(1);
  let schema = z.coerce
    .number({ error: `Enter a valid ${label}` })
    .refine(Number.isFinite, `Enter a valid ${label}`)
    .refine((n) => n >= min, min > 0 ? `${cap} must be more than zero` : `${cap} can't be negative`)
    .refine((n) => n <= max, `${cap} is too large`);
  if (decimals !== undefined) {
    schema = schema.refine((n) => placesOf(n) <= decimals, `${cap}: ${decimalsMessage(decimals).toLowerCase()}`);
  }
  return z.preprocess((v) => blank(cleanNumeric(v)), schema);
}

/** A money amount typed by the user: at most 2 decimals. */
export const money = (label: string, opts: { min?: number; max?: number } = {}) =>
  number(label, { ...opts, decimals: MONEY_DECIMALS });

/**
 * Smallest quantity the database can store (8 decimal places). How many decimals a category really allows
 * is checked per asset type with `limitError`, because it depends on the type chosen.
 */
export const qty = (label = "quantity") => number(label, { min: 1e-8, max: 1e10 });
