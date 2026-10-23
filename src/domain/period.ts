import { financialYear } from "./dates";

export interface Period {
  /** "fy:2025-26", "all" or "custom". */
  value: string;
  label: string;
  from: string | null;
  to: string | null;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const FY = /^\d{4}-\d{2}$/;

export function fyRange(fy: string): { from: string; to: string } {
  const start = Number(fy.slice(0, 4));
  return { from: `${start}-04-01`, to: `${start + 1}-03-31` };
}

/** Financial years from the one containing `earliest` (or the current one) up to today's, newest first. */
export function fyOptions(earliest: string | null, today: string): string[] {
  const current = Number(financialYear(today).slice(0, 4));
  const first = earliest ? Math.min(Number(financialYear(earliest).slice(0, 4)), current) : current;
  const out: string[] = [];
  for (let y = current; y >= first; y--) out.push(`${y}-${String((y + 1) % 100).padStart(2, "0")}`);
  return out;
}

/** Turn URL params into a period. Defaults to the current financial year. */
export function resolvePeriod(
  input: { period?: string; from?: string; to?: string },
  today: string,
): Period {
  const { period, from, to } = input;

  if (period === "all") return { value: "all", label: "All time", from: null, to: null };

  if (period === "custom" && from && to && ISO.test(from) && ISO.test(to)) {
    const [a, b] = from <= to ? [from, to] : [to, from];
    return { value: "custom", label: "Custom range", from: a, to: b };
  }

  if (period?.startsWith("fy:") && FY.test(period.slice(3))) {
    const fy = period.slice(3);
    return { value: period, label: `FY ${fy}`, ...fyRange(fy) };
  }

  const fy = financialYear(today);
  return { value: `fy:${fy}`, label: `FY ${fy}`, ...fyRange(fy) };
}

export function inPeriod(date: string, p: Period): boolean {
  return (!p.from || date >= p.from) && (!p.to || date <= p.to);
}
