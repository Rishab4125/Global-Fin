import { createHash } from "node:crypto";

export const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

function ymd(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Accepts ISO, dd-mm-yyyy, dd/mm/yyyy, "05 Mar 2025", "Mar 05, 2025" and Excel serial numbers. Day comes first. */
export function toIsoDate(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  let m = t.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return ymd(+m[1], +m[2], +m[3]);
  m = t.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (m) return ymd(+m[3], +m[2], +m[1]);
  m = t.match(/^(\d{1,2})[\s-]+([A-Za-z]{3,9})[\s,-]+(\d{4})/);
  if (m && MONTHS[m[2].slice(0, 3).toLowerCase()]) return ymd(+m[3], MONTHS[m[2].slice(0, 3).toLowerCase()], +m[1]);
  m = t.match(/^([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})/);
  if (m && MONTHS[m[1].slice(0, 3).toLowerCase()]) return ymd(+m[3], MONTHS[m[1].slice(0, 3).toLowerCase()], +m[2]);
  if (/^\d{5}(\.\d+)?$/.test(t)) {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(Number(t)) * 86400000);
    return ymd(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }
  return null;
}

/** "1,234.50", "₹1,234", "(500)" -> number. NaN when empty or not numeric. */
export function toNumber(raw: string): number {
  const t = raw.replace(/[₹,\s]/g, "");
  if (!t) return NaN;
  const n = Number(t.replace(/[()]/g, ""));
  return /^\(.*\)$/.test(t) ? -n : n;
}

export type Aliases = Record<string, string[]>;

export interface Header {
  index: number;
  col: Record<string, number | undefined>;
}

/** Find the header row: every `required` field must match one of its aliases (compared without case or punctuation). */
export function findHeader(rows: string[][], required: Aliases, optional: Aliases = {}): Header | null {
  for (let i = 0; i < Math.min(rows.length, 50); i++) {
    const cells = rows[i].map(norm);
    const col: Record<string, number | undefined> = {};
    let ok = true;
    for (const [key, aliases] of Object.entries(required)) {
      const idx = cells.findIndex((c) => aliases.includes(c));
      if (idx < 0) {
        ok = false;
        break;
      }
      col[key] = idx;
    }
    if (!ok) continue;
    for (const [key, aliases] of Object.entries(optional)) {
      const idx = cells.findIndex((c) => aliases.includes(c));
      if (idx >= 0) col[key] = idx;
    }
    return { index: i, col };
  }
  return null;
}

export const cell = (row: string[], i: number | undefined) => (i === undefined ? "" : (row[i] ?? "").trim());

/** Deterministic id for rows without one. Identical rows in a file get #2, #3... so a re-upload yields the same ids. */
export function stableId(parts: (string | number)[], seen: Map<string, number>): string {
  const base = createHash("sha1").update(parts.join("|")).digest("hex").slice(0, 16);
  const n = (seen.get(base) ?? 0) + 1;
  seen.set(base, n);
  return n === 1 ? base : `${base}#${n}`;
}
