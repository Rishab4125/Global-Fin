// Facts shown on a holding's page that are worked out from its purchases and saved details. Pure and tested.
import { addMonths, heldLongerThan } from "../../domain/dates";
import { TYPE_FIELDS } from "../../domain/investmentFields";
import type { AssetTypeId } from "../../domain/taxRules";
import { formatDate } from "../../lib/format";
import type { ListLot } from "./list";

const EPS = 1e-9;
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

const dayNumber = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
};

const nextDay = (iso: string) => {
  const d = new Date((dayNumber(iso) + 1) * 86_400_000);
  return d.toISOString().slice(0, 10);
};

export interface LotTerm {
  id: string;
  buyDate: string;
  /** Units left from this purchase, in today's units after any splits. */
  qty: number;
  /** What those units cost. */
  cost: number;
  /** "none" for assets taxed the same whatever the holding period. */
  term: "short" | "long" | "none";
  /** First day a sale would be long term, while the lot is still short term. */
  longFrom: string | null;
  daysToLong: number | null;
}

/**
 * For each purchase that still has units: whether a sale today would be short or long term, and when a short-term
 * one turns long-term. A sale is long term only after MORE than the rule's months, so the first long-term day is the
 * day after the anniversary.
 */
export function lotTerms(
  lots: ListLot[],
  sold: Map<string, number>,
  longTermMonths: number | null,
  today: string,
  unitsNow = 1,
): LotTerm[] {
  const out: LotTerm[] = [];
  for (const l of lots) {
    const rem = l.qty - (sold.get(l.id) ?? 0);
    if (rem <= EPS) continue;
    const qty = (rem * unitsNow) / (l.u ?? 1);
    const cost = round2(rem * (l.unitPrice + l.fees / l.qty));
    if (longTermMonths === null) {
      out.push({ id: l.id, buyDate: l.buyDate, qty, cost, term: "none", longFrom: null, daysToLong: null });
    } else if (heldLongerThan(l.buyDate, today, longTermMonths)) {
      out.push({ id: l.id, buyDate: l.buyDate, qty, cost, term: "long", longFrom: null, daysToLong: null });
    } else {
      const longFrom = nextDay(addMonths(l.buyDate, longTermMonths));
      out.push({ id: l.id, buyDate: l.buyDate, qty, cost, term: "short", longFrom, daysToLong: dayNumber(longFrom) - dayNumber(today) });
    }
  }
  return out.sort((a, b) => (a.buyDate < b.buyDate ? -1 : 1));
}

export interface TermSplit {
  shortQty: number;
  shortCost: number;
  longQty: number;
  longCost: number;
}

export function splitByTerm(terms: LotTerm[]): TermSplit {
  const s: TermSplit = { shortQty: 0, shortCost: 0, longQty: 0, longCost: 0 };
  for (const t of terms) {
    if (t.term === "long") {
      s.longQty += t.qty;
      s.longCost += t.cost;
    } else if (t.term === "short") {
      s.shortQty += t.qty;
      s.shortCost += t.cost;
    }
  }
  s.shortCost = round2(s.shortCost);
  s.longCost = round2(s.longCost);
  return s;
}

/** Saved details as label/value pairs for the Info tab, in the order the Add form asks for them. */
export function detailRows(type: AssetTypeId, isin: string | null, details: Record<string, unknown>): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [];
  if (isin) rows.push({ label: "ISIN", value: isin });
  for (const f of TYPE_FIELDS[type] ?? []) {
    if (f.key === "isin") continue;
    const v = details[f.key];
    if (v === undefined || v === null || v === "") continue;
    rows.push({ label: f.label.replace(/ \((%|₹)\)$/, ""), value: formatDetail(f.kind, f.label, v) });
  }
  if (typeof details.nickname === "string" && details.nickname) rows.push({ label: "Account nickname", value: details.nickname });
  return rows;
}

function formatDetail(kind: string, label: string, v: unknown): string {
  if (kind === "date" && typeof v === "string") return formatDate(v);
  if (kind === "number" && typeof v === "number") {
    if (label.endsWith("(%)")) return `${v}%`;
    if (label.endsWith("(₹)")) return `₹${v.toLocaleString("en-IN")}`;
    return String(v);
  }
  return String(v);
}
