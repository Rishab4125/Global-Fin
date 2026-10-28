import { eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { assets, buyLots, corporateActions, miscEntries, saleAllocations, sales, userPlatforms, userSettings } from "@/db/schema";
import { unitsAt, unitsNow, type ActionType, type CorporateAction } from "@/domain/corporateActions";
import { computeHoldings, type Lot } from "@/domain/fifo";
import {
  computeRealised,
  type GainEvent,
  type MiscEvent,
  type RealisedRow,
  type SaleEvent,
} from "@/domain/gains";
import { platformOptions } from "@/domain/platform";
import { todayIso } from "@/domain/dates";
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
  /** Splits, bonus issues and dividends. */
  actions: CorporateAction[];
  /** Dividends as income events, kept apart from Misc entries because they live on a holding. */
  dividendEvents: MiscEvent[];
  slabRate: number;
  /** Every platform the user can pick or filter by. */
  platforms: string[];
  rows: RealisedRow[];
  holdings: HoldingView[];
}

const asType = (t: string): AssetTypeId => (isAssetType(t) ? t : "other");

export async function loadPortfolio(userId: string): Promise<Portfolio> {
  const [assetRows, lotRows, saleRows, miscRows, settings, platformRows, actionRows] = await Promise.all([
    db.select().from(assets).where(eq(assets.userId, userId)),
    db.select().from(buyLots).where(eq(buyLots.userId, userId)),
    db.select().from(sales).where(eq(sales.userId, userId)),
    db.select().from(miscEntries).where(eq(miscEntries.userId, userId)),
    db.select().from(userSettings).where(eq(userSettings.userId, userId)),
    db.select().from(userPlatforms).where(eq(userPlatforms.userId, userId)),
    db.select().from(corporateActions).where(eq(corporateActions.userId, userId)),
  ]);

  const actions: CorporateAction[] = actionRows.map((a) => ({
    id: a.id,
    assetId: a.assetId,
    type: a.type as ActionType,
    date: a.actionDate,
    ratioNew: Number(a.ratioNew),
    ratioOld: Number(a.ratioOld),
    amount: Number(a.amount),
    tds: Number(a.tds),
    note: a.note,
  }));

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
    platform: l.platform,
    eventId: l.eventId,
    u: unitsAt(actions, l.assetId, l.buyDate),
  }));
  const lotPlatform = new Map(lots.map((l) => [l.id, l.platform ?? "Other"]));

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
      tenderedQty: s.tenderedQty === null ? null : Number(s.tenderedQty),
      u: unitsAt(actions, s.assetId, s.sellDate),
      source: s.source,
      allocations: allocRows
        .filter((a) => a.saleId === s.id)
        .map((a) => ({ lotId: a.lotId, qty: Number(a.qty) })),
      platforms: [
        ...new Set(allocRows.filter((a) => a.saleId === s.id).map((a) => lotPlatform.get(a.lotId) ?? "Other")),
      ],
    };
  });

  const miscEvents: MiscEvent[] = miscRows.map((m) => ({
    kind: "misc",
    id: m.id,
    assetType: asType(m.assetType),
    date: m.entryDate,
    amount: Number(m.amount),
    taxAdjusted: m.taxAdjusted,
    term: (m.term === "LTCG" ? "LTCG" : "STCG") as Term,
    entryType: "general",
    brokerage: Number(m.brokerage),
    note: m.note,
  }));

  const slabRate = settings[0] ? Number(settings[0].slabRate) : DEFAULT_SLAB_RATE;
  const dividendEvents: MiscEvent[] = actions
    .filter((a) => a.type === "dividend")
    .map((a) => ({
      kind: "misc",
      id: a.id,
      assetId: a.assetId,
      assetName: assetMap.get(a.assetId)?.name ?? "Unknown",
      assetType: assetMap.get(a.assetId)?.type ?? "other",
      date: a.date,
      amount: a.amount,
      taxAdjusted: false,
      term: "STCG" as Term,
      entryType: "dividend" as const,
      brokerage: 0,
      note: a.tds > 0 ? `TDS deducted ${a.tds}.` : "",
    }));
  const events: GainEvent[] = [...saleEvents, ...miscEvents, ...dividendEvents];
  const rows = computeRealised(events, lots, slabRate);

  const h = computeHoldings(lots, sold, unitsNow(actions, todayIso()));
  const holdings: HoldingView[] = [];
  for (const hold of h.values()) {
    const a = assetMap.get(hold.assetId);
    if (a) holdings.push({ ...a, qty: hold.qty, cost: hold.cost, avgCost: hold.avgCost });
  }
  holdings.sort((x, y) => y.cost - x.cost);

  const platforms = platformOptions(
    platformRows.map((p) => p.name).sort(),
    lots.map((l) => l.platform ?? "Other"),
  );

  return { assets: assetViews, lots, sold, saleEvents, miscEvents, actions, dividendEvents, slabRate, platforms, rows, holdings };
}
