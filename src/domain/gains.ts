import { financialYear, heldLongerThan } from "./dates";
import { lotUnitCost, type Allocation, type Lot } from "./fifo";
import {
  ASSET_RULES,
  BUYBACK_DIVIDEND_FROM,
  CESS,
  equityExemptionFor,
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
  /** Sold back to the company in a share buyback: taxed as dividend, cost is a capital loss. */
  buyback?: boolean;
  allocations: Allocation[];
  source?: string;
  /** Platforms of the lots this sale consumed. */
  platforms?: string[];
  /** Units factor of the sale date (splits on or before it). */
  u?: number;
  /** Shares tendered in a buyback; `qty` is the accepted part. */
  tenderedQty?: number | null;
}

export interface MiscEvent {
  kind: "misc";
  /** "general" is a plain profit/loss; "dividend" is income from a holding, taxed at slab rate. */
  entryType: "general" | "dividend";
  /** The holding a dividend belongs to. */
  assetId?: string;
  assetName?: string;
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
  /** Dividend income. It is part of `gain` but is neither short- nor long-term capital gain. */
  income: number;
  tax: number;
  netGain: number;
  taxApplied: boolean;
  /** Part of the gain covered by the yearly equity LTCG exemption. */
  exemptionUsed: number;
  /** Gain that actually attracted tax (after losses and exemption). */
  taxableGain: number;
  /** Equity exemption still unused in this FY after this event. */
  exemptionLeft: number | null;
  /** Part of this gain wiped out by losses in the same FY. */
  offsetByLosses: number;
  /** Part of this loss that reduced gains in the same FY. */
  lossUsed: number;
  /** Tax this loss saved across the FY. */
  taxSaved: number;
  buyback: boolean;
  note: string;
}

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

const EPS = 1e-9;

function resolveRate(rate: Rate, slabRate: number): number {
  if (rate.kind === "exempt") return 0;
  if (rate.kind === "slab") return slabRate;
  return rate.rate;
}

function salePieces(sale: SaleEvent, lots: Map<string, Lot>) {
  const rule = ASSET_RULES[sale.assetType];
  // Crypto (section 115BBH) allows only the cost of acquisition, so charges on the sale are not deducted.
  const saleFees = sale.assetType === "crypto" ? 0 : sale.fees;
  let stcg = 0;
  let ltcg = 0;
  let cost = 0;
  let costStcg = 0;
  let costLtcg = 0;
  for (const a of sale.allocations) {
    const lot = lots.get(a.lotId);
    if (!lot) continue;
    // Allocations are in lot units; the sale and its price are in the units of the sale date (after any splits).
    const saleUnits = a.qty * ((sale.u ?? 1) / (lot.u ?? 1));
    const allocCost = a.qty * lotUnitCost(lot);
    const proceeds = saleUnits * sale.price - saleFees * (saleUnits / sale.qty);
    const gain = proceeds - allocCost;
    cost += allocCost;
    const isLong =
      rule.longTermMonths !== null && heldLongerThan(lot.buyDate, sale.date, rule.longTermMonths);
    if (isLong) {
      ltcg += gain;
      costLtcg += allocCost;
    } else {
      stcg += gain;
      costStcg += allocCost;
    }
  }
  const proceeds = sale.qty * sale.price - saleFees;
  return { stcg, ltcg, cost, costStcg, costLtcg, proceeds };
}

/** One taxable gain or loss: a short- or long-term part of an event. */
interface Piece {
  event: number;
  term: Term;
  gain: number;
  rate: number;
  date: string;
  equityExempt: boolean;
  /** Losses cannot reduce this gain and this loss cannot reduce others (crypto). */
  isolated: boolean;
}

interface Settled {
  offset: number[];
  lossUsed: number[];
  exempt: number[];
  taxable: number[];
  tax: number[];
  totalTax: number;
}

/**
 * Tax for one financial year. With `setOff` on, losses first reduce gains: a short-term loss can reduce
 * any gain, a long-term loss only long-term gains, each applied to the highest-taxed gain first (equity
 * long-term gains last, since part of them is exempt anyway). The yearly equity LTCG exemption then applies,
 * oldest sale first, to what is left.
 */
function settleYear(pieces: Piece[], setOff: boolean): Settled {
  const n = pieces.length;
  const offset = new Array<number>(n).fill(0);
  const lossUsed = new Array<number>(n).fill(0);
  const exempt = new Array<number>(n).fill(0);
  const taxable = new Array<number>(n).fill(0);
  const tax = new Array<number>(n).fill(0);

  if (setOff) {
    const byRate = (a: number, b: number) =>
      pieces[b].rate - pieces[a].rate || Number(pieces[a].equityExempt) - Number(pieces[b].equityExempt);
    const idx = pieces.map((_, i) => i);
    const gains = idx.filter((i) => pieces[i].gain > EPS && !pieces[i].isolated).sort(byRate);
    const longGains = gains.filter((i) => pieces[i].term === "LTCG");
    const lossesOf = (term: Term) => idx.filter((i) => pieces[i].gain < -EPS && !pieces[i].isolated && pieces[i].term === term);

    const spend = (term: Term, targets: number[]) => {
      const losses = lossesOf(term);
      const total = losses.reduce((s, i) => s - pieces[i].gain, 0);
      let left = total;
      for (const g of targets) {
        if (left <= EPS) break;
        const use = Math.min(left, pieces[g].gain - offset[g]);
        if (use <= EPS) continue;
        offset[g] += use;
        left -= use;
      }
      const used = total - left;
      if (total > EPS) for (const i of losses) lossUsed[i] += (-pieces[i].gain / total) * used;
    };
    spend("LTCG", longGains);
    spend("STCG", gains);
  }

  let exemptionLeft: number | null = null;
  for (let i = 0; i < n; i++) {
    const p = pieces[i];
    if (p.gain <= EPS) continue;
    let base = p.gain - offset[i];
    if (p.equityExempt && p.term === "LTCG") {
      exemptionLeft ??= equityExemptionFor(p.date);
      const used = Math.min(exemptionLeft, base);
      exemptionLeft -= used;
      exempt[i] = used;
      base -= used;
    }
    taxable[i] = base;
    tax[i] = base * p.rate * (1 + CESS);
  }
  return { offset, lossUsed, exempt, taxable, tax, totalTax: tax.reduce((s, x) => s + x, 0) };
}

/**
 * Compute realised gains and tax for every event. Losses reduce gains within the same financial year
 * before tax; the yearly equity LTCG exemption is then used oldest sale first. Losses are not carried
 * forward to later years.
 */
export function computeRealised(
  events: GainEvent[],
  lots: Lot[],
  slabRate: number,
): RealisedRow[] {
  const lotMap = new Map(lots.map((l) => [l.id, l]));
  const indexed = events.map((e, i) => ({ e, i }));
  indexed.sort((a, b) => (a.e.date === b.e.date ? a.i - b.i : a.e.date < b.e.date ? -1 : 1));

  type Draft = {
    e: GainEvent;
    fy: string;
    stcg: number;
    ltcg: number;
    taxApplied: boolean;
    income: number;
    row: Omit<
      RealisedRow,
      | "gain" | "stcg" | "ltcg" | "income" | "tax" | "netGain" | "taxApplied" | "exemptionUsed" | "taxableGain"
      | "exemptionLeft" | "offsetByLosses" | "lossUsed" | "taxSaved" | "buyback"
    >;
    tax: number;
    taxableGain: number;
    extraNote: string;
    buyback: boolean;
  };

  const drafts: Draft[] = [];
  const piecesByFy = new Map<string, Piece[]>();

  for (const { e } of indexed) {
    const fy = financialYear(e.date);
    const rule = ASSET_RULES[e.assetType];

    let stcg: number;
    let ltcg: number;
    let taxApplied: boolean;
    let row: Draft["row"];
    let buyback = false;
    let dividend = 0;
    let income = 0;
    let isDividend = false;
    let costS = 0;
    let costL = 0;

    if (e.kind === "sale") {
      const p = salePieces(e, lotMap);
      stcg = p.stcg;
      ltcg = p.ltcg;
      taxApplied = e.applyTax && !(e.exemptRedemption && e.assetType === "sgb");
      buyback = !!e.buyback;
      dividend = e.qty * e.price;
      costS = p.costStcg;
      costL = p.costLtcg;
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
        note: [e.exemptRedemption && e.assetType === "sgb" ? "Tax-free RBI redemption" : "", e.buyback ? (e.tenderedQty ? `Share buyback: ${e.qty} of ${e.tenderedQty} tendered shares accepted.` : "Share buyback.") : ""]
          .filter(Boolean)
          .join(" "),
      };
    } else {
      isDividend = e.entryType === "dividend";
      const isLong = !isDividend && e.term === "LTCG" && rule.longTermMonths !== null;
      const net = e.amount - e.brokerage;
      // A dividend is income, not a capital gain, so it sits outside the short/long-term split.
      income = isDividend ? e.amount : 0;
      stcg = isDividend || isLong ? 0 : net;
      ltcg = !isDividend && isLong ? net : 0;
      taxApplied = !e.taxAdjusted;
      row = {
        id: e.id,
        kind: "misc",
        date: e.date,
        fy,
        assetType: e.assetType,
        label: isDividend ? `Dividend: ${e.assetName ?? "holding"}` : "Misc P/L",
        qty: null,
        proceeds: null,
        cost: null,
        note: [e.taxAdjusted ? "Tax already adjusted." : "", e.brokerage > 0 ? `Brokerage ${inr(e.brokerage)}.` : "", e.note]
          .filter(Boolean)
          .join(" "),
      };
    }

    const draft: Draft = { e, fy, stcg, ltcg, income, taxApplied, row, tax: 0, taxableGain: 0, extraNote: "", buyback };
    const eventIndex = drafts.length;
    drafts.push(draft);

    if (buyback) {
      if (e.date < BUYBACK_DIVIDEND_FROM) {
        draft.extraNote = "Buyback before 1 Oct 2024: tax-free for the shareholder.";
      } else {
        draft.extraNote = `Proceeds taxed as dividend at slab rate. The cost of ${inr(costS + costL)} is a capital loss that reduces gains in the same financial year.`;
        if (taxApplied && dividend > 0) {
          draft.taxableGain = dividend;
          draft.tax = dividend * slabRate * (1 + CESS);
        }
        if (taxApplied) {
          for (const [term, cost] of [["STCG", costS], ["LTCG", costL]] as const) {
            if (cost <= EPS) continue;
            const list = piecesByFy.get(fy) ?? [];
            list.push({
              event: eventIndex,
              term,
              gain: -cost,
              rate: 0,
              date: e.date,
              equityExempt: false,
              isolated: !!rule.noLossSetOff,
            });
            piecesByFy.set(fy, list);
          }
        }
      }
    } else if (isDividend) {
      // Dividend income is taxed at slab rate. It is not a capital gain, so losses are not set off against it.
      draft.extraNote = "Dividend taxed at slab rate. TDS already deducted, if any, is not subtracted here.";
      if (taxApplied && income > 0) {
        draft.taxableGain = income;
        draft.tax = income * slabRate * (1 + CESS);
      }
    } else if (taxApplied) {
      for (const [term, gain] of [["STCG", stcg], ["LTCG", ltcg]] as const) {
        if (Math.abs(gain) <= EPS) continue;
        let rate: Rate = term === "STCG" ? rule.stcg : rule.ltcg;
        if (rule.usesEquityExemption) {
          const eq = equityRatesFor(e.date);
          rate = { kind: "flat", rate: term === "STCG" ? eq.stcg : eq.ltcg };
        }
        if (rate.kind === "exempt") continue;
        const list = piecesByFy.get(fy) ?? [];
        list.push({
          event: eventIndex,
          term,
          gain,
          rate: resolveRate(rate, slabRate),
          date: e.date,
          equityExempt: !!rule.usesEquityExemption,
          isolated: !!rule.noLossSetOff,
        });
        piecesByFy.set(fy, list);
      }
    }
  }

  const offsetBy = new Array<number>(drafts.length).fill(0);
  const lossUsedBy = new Array<number>(drafts.length).fill(0);
  const exemptBy = new Array<number>(drafts.length).fill(0);
  const savedBy = new Array<number>(drafts.length).fill(0);

  for (const pieces of piecesByFy.values()) {
    const withSetOff = settleYear(pieces, true);
    const without = settleYear(pieces, false);
    const saved = Math.max(0, without.totalTax - withSetOff.totalTax);
    const totalLossUsed = withSetOff.lossUsed.reduce((s, x) => s + x, 0);
    pieces.forEach((p, i) => {
      const d = drafts[p.event];
      d.tax += withSetOff.tax[i];
      d.taxableGain += withSetOff.taxable[i];
      offsetBy[p.event] += withSetOff.offset[i];
      lossUsedBy[p.event] += withSetOff.lossUsed[i];
      exemptBy[p.event] += withSetOff.exempt[i];
      if (totalLossUsed > EPS) savedBy[p.event] += (saved * withSetOff.lossUsed[i]) / totalLossUsed;
    });
  }

  const exemptionUsedInFy = new Map<string, number>();
  return drafts.map((d, i) => {
    const rule = ASSET_RULES[d.e.assetType];
    exemptionUsedInFy.set(d.fy, (exemptionUsedInFy.get(d.fy) ?? 0) + exemptBy[i]);
    const gain = d.stcg + d.ltcg + d.income;

    const notes = [d.row.note, d.extraNote];
    if (lossUsedBy[i] > 0.005) {
      notes.push(
        `${inr(lossUsedBy[i])} of this loss is set off against gains in ${d.fy}${savedBy[i] > 0.005 ? `, saving about ${inr(savedBy[i])} of tax` : ""}.`,
      );
    }
    if (offsetBy[i] > 0.005) notes.push(`${inr(offsetBy[i])} of this gain is set off by losses in ${d.fy}.`);

    return {
      ...d.row,
      note: notes.filter(Boolean).join(" "),
      gain: round2(gain),
      stcg: round2(d.stcg),
      ltcg: round2(d.ltcg),
      income: round2(d.income),
      tax: round2(d.tax),
      netGain: round2(gain - d.tax),
      taxApplied: d.taxApplied,
      exemptionUsed: round2(exemptBy[i]),
      taxableGain: round2(d.taxableGain),
      exemptionLeft: rule.usesEquityExemption
        ? round2(equityExemptionFor(d.e.date) - (exemptionUsedInFy.get(d.fy) ?? 0))
        : null,
      offsetByLosses: round2(offsetBy[i]),
      lossUsed: round2(lossUsedBy[i]),
      taxSaved: round2(savedBy[i]),
      buyback: d.buyback,
    };
  });
}
