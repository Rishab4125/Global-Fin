// Small number helpers shared by the server validators and the form fields. No dependencies, safe in the browser.

/** "₹1,25,000.50" -> "125000.50". Pasted amounts often carry the symbol, commas or spaces. */
export const cleanNumeric = (v: unknown) => (typeof v === "string" ? v.replace(/[₹,\s]/g, "") : v);

/** Digits after the decimal point in typed text such as "10.250". Expects text already cleaned. */
export function placesOfText(s: string): number {
  const i = s.indexOf(".");
  return i < 0 ? 0 : s.length - i - 1;
}

/** The message for a typed value with too many decimals, or "" when it is fine (or not yet a number). */
export function decimalsError(text: string, max: number): string {
  if (!/^-?\d*\.?\d*$/.test(text)) return "Enter a number";
  return placesOfText(text) > max ? (max === 0 ? "Whole units only" : `Up to ${max} decimals`) : "";
}

/** A number as plain decimal text without exponent form or trailing zeros: 1.2e-7 -> "0.00000012", 10 -> "10". */
export const plainNumber = (n: number) => n.toFixed(8).replace(/\.?0+$/, "") || "0";
