/** Which platform holds an investment, derived from where its trade came from. */
export function platformOf(source: string | undefined): string {
  if (!source) return "Other";
  if (source.startsWith("zerodha") || source === "kite_sync") return "Zerodha";
  if (source.startsWith("groww")) return "Groww";
  return "Other";
}
