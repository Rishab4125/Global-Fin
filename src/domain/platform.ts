/** Platforms every user starts with. Users can add their own (banks, other brokers, "Self / locker"). */
export const DEFAULT_PLATFORMS = ["Zerodha", "Groww", "Other"];

export const MAX_PLATFORM_LENGTH = 40;

/** The platform a trade belongs to, from the report or sync it came from. Used when a trade has no explicit platform. */
export function platformOf(source: string | undefined): string {
  if (!source) return "Other";
  if (source.startsWith("zerodha") || source === "kite_sync") return "Zerodha";
  if (source.startsWith("groww")) return "Groww";
  return "Other";
}

/** Defaults first, then the user's own, then any used on a purchase, without repeats. */
export function platformOptions(custom: string[], used: string[]): string[] {
  return [...new Set([...DEFAULT_PLATFORMS, ...custom, ...used])];
}
