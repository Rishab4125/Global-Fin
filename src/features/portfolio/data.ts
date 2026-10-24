import { eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { assets, buyLots, miscEntries, saleAllocations, sales, userSettings } from "@/db/schema";
import { computeHoldings, type Lot } from "@/domain/fifo";
import {
  computeRealised,
  type GainEvent,
  type MiscEvent,
  type RealisedRow,
  type SaleEvent,
} from "@/domain/gains";
import { DEFAULT_SLAB_RATE, isAssetType, type AssetTypeId, type Term } from "@/domain/taxRules";

export interface AssetView {
  id: string;
  type: AssetTypeId;
  name: string;
  isin: string | null;
}

export interface HoldingView extends AssetView {
  qty: number;
  cost: number;
  avgCost: number;
}

export interface Portfolio {
  assets: AssetView[];
  lots: Lot[];
  sold: Map<string, number>;
  saleEvents: SaleEvent[];
  miscEvents: MiscEvent[];
  slabRate: number;
  rows: RealisedRow[];
  holdings: HoldingView[];
}

const asType = (t: string): AssetTypeId => (isAssetType(t) ? t : "other");

export async function loadPortfolio(userId: string): Promise<Portfolio> {
  const [assetRows, lotRows, saleRows, miscRows, settings] = await Promise.all([
    db.select().from(assets).where(eq(assets.userId, userId)),
    db.select().from(buyLots).where(eq(buyLots.userId, userId)),
    db.select().from(sales).where(eq(sales.userId, userId)),
    db.select().from(miscEntries).where(eq(miscEntries.userId, userId)),
    db.select().from(userSettings).where(eq(userSettings.userId, userId)),
  ]);

  const saleIds = saleRows.map((s) => s.id);
  const allocRows = saleIds.length
    ? await db.select().from(saleAllocations).where(inArray(saleAllocations.saleId, saleIds))
    : [];

  const assetViews: AssetView[] = assetRows.map((a) => ({
    id: a.id,
    type: asType(a.type),
    name: a.name,
    isin: a.isin,
  }));
  const assetMap = new Map(assetViews.map((a) => [a.id, a]));

  const lots: Lot[] = lotRows.map((l) => ({
    id: l.id,
    assetId: l.assetId,
    buyDate: l.buyDate,
    qty: Number(l.qty),
    unitPrice: Number(l.unitPrice),
    fees: Number(l.fees),
    source: l.source,
  }));

  const sold = new Map<string, number>();
  for (const a of allocRows) sold.set(a.lotId, (sold.get(a.lotId) ?? 0) + Number(a.qty));

  const saleEvents: SaleEvent[] = saleRows.map((s) => {
    const asset = assetMap.get(s.assetId);
    return {
      kind: "sale",
      id: s.id,
      assetId: s.assetId,
      assetName: asset?.name ?? "Unknown",
      assetType: asset?.type ?? "other",
      date: s.sellDate,
      qty: Number(s.qty),
      price: Number(s.price),
      fees: Number(s.fees),
      applyTax: s.applyTax,
      exemptRedemption: s.exemptRedemption,
      buyback: s.isBuyback,
      source: s.source,
      allocations: allocRows
        .filter((a) => a.saleId === s.id)
        .map((a) => ({ lotId: a.lotId, qty: Number(a.qty) })),
    };
  });

  const miscEvents: MiscEvent[] = miscRows.map((m) => ({
    kind: "misc",
    id: m.id,
    assetType: m.assetType === "buyback" ? "equity" : asType(m.assetType),
    date: m.entryDate,
    amount: Number(m.amount),
    taxAdjusted: m.taxAdjusted,
    term: (m.term === "LTCG" ? "LTCG" : "STCG") as Term,
    entryType: m.assetType === "buyback" ? "buyback" : "general",
    cost: Number(m.cost),
    brokerage: Number(m.brokerage),
    note: m.note,
  }));

  const slabRate = settings[0] ? Number(settings[0].slabRate) : DEFAULT_SLAB_RATE;
  const events: GainEvent[] = [...saleEvents, ...miscEvents];
  const rows = computeRealised(events, lots, slabRate);

  const h = computeHoldings(lots, sold);
  const holdings: HoldingView[] = [];
  for (const hold of h.values()) {
    const a = assetMap.get(hold.assetId);
    if (a) holdings.push({ ...a, qty: hold.qty, cost: hold.cost, avgCost: hold.avgCost });
  }
  holdings.sort((x, y) => y.cost - x.cost);

  return { assets: assetViews, lots, sold, saleEvents, miscEvents, slabRate, rows, holdings };
}
