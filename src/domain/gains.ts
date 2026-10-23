import { financialYear, heldLongerThan } from "./dates";
import { lotUnitCost, type Allocation, type Lot } from "./fifo";
import {
  ASSET_RULES,
  BUYBACK_DIVIDEND_FROM,
  CESS,
  equityRatesFor,
  type AssetTypeId,
  type Rate,
  type Term,
} from "./taxRules";

export interface SaleEvent {
  kind: "sale";
  id: string;
  assetId: string;
  assetName: string;
  assetType: AssetTypeId;
  date: string;
  qty: number;
  price: number;
  fees: number;
  applyTax: boolean;
  exemptRedemption: boolean;
  allocations: Allocation[];
}

export interface MiscEvent {
  kind: "misc";
  /** "general" is a plain profit/loss; "buyback" has proceeds (amount) and a cost of shares. */
  entryType: "general" | "buyback";
  /** Cost of the shares bought back (buyback only). */
  cost: number;
  brokerage: number;
  id: string;
  assetType: AssetTypeId;
  date: string;
  amount: number;
  taxAdjusted: boolean;
  term: Term;
  note: string;
}

export type GainEvent = SaleEvent | MiscEvent;

export interface RealisedRow {
  id: string;
  kind: "sale" | "misc";
  date: string;
  fy: string;
  assetType: AssetTypeId;
  label: string;
  qty: number | null;
  proceeds: number | null;
  cost: number | null;
  gain: number;
  stcg: number;
  ltcg: number;
  tax: number;
  netGain: number;
  taxApplied: boolean;
  /** Part of the gain covered by the yearly equity LTCG exemption. */
  exemptionUsed: number;
  /** Gain that actually attracted tax (after exemption). */
  taxableGain: number;
  /** Equity exemption still unused in this FY after this event. */
  exemptionLeft: number | null;
  note: string;
}

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

interface Piece {
  term: Term;
  gain: number;
}

function resolveRate(rate: Rate, slabRate: number): number {
  if (rate.kind === "exempt") return 0;
  if (rate.kind === "slab") return slabRate;
  return rate.rate;
}

function salePieces(sale: SaleEvent, lots: Map<string, Lot>) {
  const rule = ASSET_RULES[sale.assetType];
  let stcg = 0;
  let ltcg = 0;
  let cost = 0;
  for (const a of sale.allocations) {
    const lot = lots.get(a.lotId);
    if (!lot) continue;
    const allocCost = a.qty * lotUnitCost(lot);
    const proceeds = a.qty * sale.price - sale.fees * (a.qty / sale.qty);
    const gain = proceeds - allocCost;
    cost += allocCost;
    const isLong =
      rule.longTermMonths !== null && heldLongerThan(lot.buyDate, sale.date, rule.longTermMonths);
    if (isLong) ltcg += gain;
    else stcg += gain;
  }
  const proceeds = sale.qty * sale.price - sale.fees;
  return { stcg, ltcg, cost, proceeds };
}

/**
 * Compute realised gains and tax for every event. Events are processed in date order so the
 * yearly equity LTCG exemption is consumed chronologically within each financial year.
 */
export function computeRealised(
  events: GainEvent[],
  lots: Lot[],
  slabRate: number,
): RealisedRow[] {
  const lotMap = new Map(lots.map((l) => [l.id, l]));
  const indexed = events.map((e, i) => ({ e, i }));
  indexed.sort((a, b) => (a.e.date === b.e.date ? a.i - b.i : a.e.date < b.e.date ? -1 : 1));

  const exemptionLeft = new Map<string, number>();
  const rows: RealisedRow[] = [];

  for (const { e } of indexed) {
    const fy = financialYear(e.date);
    const rule = ASSET_RULES[e.assetType];

    let stcg: number;
    let ltcg: number;
    let taxApplied: boolean;
    let row: Omit<
      RealisedRow,
      "gain" | "stcg" | "ltcg" | "tax" | "netGain" | "taxApplied" | "exemptionUsed" | "taxableGain" | "exemptionLeft"
    >;

    if (e.kind === "sale") {
      const p = salePieces(e, lotMap);
      stcg = p.stcg;
      ltcg = p.ltcg;
      taxApplied = e.applyTax && !e.exemptRedemption;
      row = {
        id: e.id,
        kind: "sale",
        date: e.date,
        fy,
        assetType: e.assetType,
        label: e.assetName,
        qty: e.qty,
        proceeds: round2(p.proceeds),
        cost: round2(p.cost),
        note: e.exemptRedemption ? "Tax-free RBI redemption" : "",
      };
    } else {
      const isLong = e.term === "LTCG" && rule.longTermMonths !== null;
      const buyback = e.entryType === "buyback";
      const net = (buyback ? e.amount - e.cost : e.amount) - e.brokerage;
      stcg = isLong ? 0 : net;
      ltcg = isLong ? net : 0;
      taxApplied = !e.taxAdjusted;
      row = {
        id: e.id,
        kind: "misc",
        date: e.date,
        fy,
        assetType: e.assetType,
        label: buyback ? "Buyback" : "Misc P/L",
        qty: null,
        proceeds: buyback ? round2(e.amount) : null,
        cost: buyback ? round2(e.cost) : null,
        note: [e.taxAdjusted ? "Tax already adjusted." : "", e.brokerage > 0 ? `Brokerage ${inr(e.brokerage)}.` : "", e.note]
          .filter(Boolean)
          .join(" "),
      };
    }

    let tax = 0;
    let exemptionUsed = 0;
    let taxableGain = 0;
    let extraNote = "";
    if (e.kind === "misc" && e.entryType === "buyback") {
      if (e.date < BUYBACK_DIVIDEND_FROM) {
        extraNote = "Buyback before 1 Oct 2024: tax-free for the shareholder.";
      } else {
        extraNote = `Proceeds taxed as dividend at slab rate; cost ${inr(e.cost)} is a capital loss to set off against other capital gains (not modelled).`;
        if (taxApplied && e.amount > 0) {
          taxableGain = e.amount;
          tax = e.amount * slabRate * (1 + CESS);
        }
      }
    } else if (taxApplied) {
      const pieces: Piece[] = [
        { term: "STCG", gain: stcg },
        { term: "LTCG", gain: ltcg },
      ];
      for (const piece of pieces) {
        if (piece.gain <= 0) continue;
        let rate: Rate = piece.term === "STCG" ? rule.stcg : rule.ltcg;
        let exemptionTotal = 0;
        if (rule.usesEquityExemption) {
          const eq = equityRatesFor(e.date);
          rate = { kind: "flat", rate: piece.term === "STCG" ? eq.stcg : eq.ltcg };
          exemptionTotal = eq.exemption;
        }
        let taxable = piece.gain;
        if (piece.term === "LTCG" && rule.usesEquityExemption) {
          const left = exemptionLeft.get(fy) ?? exemptionTotal;
          const used = Math.min(left, taxable);
          exemptionLeft.set(fy, left - used);
          taxable -= used;
          exemptionUsed += used;
        }
        taxableGain += taxable;
        tax += taxable * resolveRate(rate, slabRate) * (1 + CESS);
      }
    }

    const gain = stcg + ltcg;
    rows.push({
      ...row,
      note: [row.note, extraNote].filter(Boolean).join(" "),
      gain: round2(gain),
      stcg: round2(stcg),
      ltcg: round2(ltcg),
      tax: round2(tax),
      netGain: round2(gain - tax),
      taxApplied,
      exemptionUsed: round2(exemptionUsed),
      taxableGain: round2(taxableGain),
      exemptionLeft: rule.usesEquityExemption ? round2(exemptionLeft.get(fy) ?? equityRatesFor(e.date).exemption) : null,
    });
  }
  return rows;
}
