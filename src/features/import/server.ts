import { and, eq, inArray } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { db } from "@/db/client";
import { assets, buyLots, saleAllocations, sales } from "@/db/schema";
import { manualKey } from "@/domain/brokerSync";
import type { ExistingLot, ExistingSale, Plan, PlanAsset } from "./plan";

export interface UserState {
  assets: PlanAsset[];
  lots: ExistingLot[];
  sales: ExistingSale[];
  importedKeys: Set<string>;
  manualKeys: Set<string>;
}

export async function loadUserState(userId: string): Promise<UserState> {
  const [assetRows, lotRows, saleRows] = await Promise.all([
    db.select().from(assets).where(eq(assets.userId, userId)),
    db.select().from(buyLots).where(eq(buyLots.userId, userId)),
    db.select().from(sales).where(eq(sales.userId, userId)),
  ]);
  const saleIds = saleRows.map((s) => s.id);
  const allocRows = saleIds.length
    ? await db.select().from(saleAllocations).where(inArray(saleAllocations.saleId, saleIds))
    : [];

  const importedKeys = new Set<string>();
  const manualKeys = new Set<string>();
  for (const l of lotRows) {
    if (l.brokerTradeId) importedKeys.add(`${l.source}:${l.brokerTradeId}`);
    else if (l.source === "manual") {
      manualKeys.add(manualKey(l.assetId, l.buyDate, "buy", Number(l.qty), Number(l.unitPrice)));
    }
  }
  for (const s of saleRows) {
    if (s.brokerTradeId) importedKeys.add(`${s.source}:${s.brokerTradeId}`);
    else if (s.source === "manual") {
      manualKeys.add(manualKey(s.assetId, s.sellDate, "sell", Number(s.qty), Number(s.price)));
    }
  }

  return {
    assets: assetRows.map((a) => ({ id: a.id, name: a.name, type: a.type, isin: a.isin })),
    lots: lotRows.map((l) => ({
      id: l.id,
      assetId: l.assetId,
      buyDate: l.buyDate,
      qty: Number(l.qty),
      unitPrice: Number(l.unitPrice),
      fees: Number(l.fees),
      source: l.source,
    })),
    sales: saleRows.map((s) => ({
      id: s.id,
      assetId: s.assetId,
      source: s.source,
      allocations: allocRows.filter((a) => a.saleId === s.id).map((a) => ({ lotId: a.lotId, qty: Number(a.qty) })),
    })),
    importedKeys,
    manualKeys,
  };
}

/** Write a plan in a single batch so an import is all-or-nothing. */
export async function executePlan(userId: string, source: string, plan: Plan): Promise<void> {
  const stmts: BatchItem<"pg">[] = [];

  if (plan.removeSaleIds.length) {
    stmts.push(db.delete(sales).where(and(eq(sales.userId, userId), inArray(sales.id, plan.removeSaleIds))));
  }
  if (plan.removeLotIds.length) {
    stmts.push(db.delete(buyLots).where(and(eq(buyLots.userId, userId), inArray(buyLots.id, plan.removeLotIds))));
  }
  if (plan.newAssets.length) {
    stmts.push(
      db.insert(assets).values(
        plan.newAssets.map((a) => ({ id: a.id, userId, type: "equity", name: a.name, isin: a.isin })),
      ),
    );
  }
  for (const s of plan.setIsin) {
    stmts.push(db.update(assets).set({ isin: s.isin }).where(and(eq(assets.id, s.assetId), eq(assets.userId, userId))));
  }
  if (plan.lots.length) {
    stmts.push(
      db.insert(buyLots).values(
        plan.lots.map((l) => ({
          id: l.id,
          userId,
          assetId: l.assetId,
          buyDate: l.buyDate,
          qty: String(l.qty),
          unitPrice: String(l.unitPrice),
          source,
          brokerTradeId: l.tradeId,
        })),
      ),
    );
  }
  if (plan.sales.length) {
    stmts.push(
      db.insert(sales).values(
        plan.sales.map((s) => ({
          id: s.id,
          userId,
          assetId: s.assetId,
          sellDate: s.sellDate,
          qty: String(s.qty),
          price: String(s.price),
          source,
          brokerTradeId: s.tradeId,
        })),
      ),
    );
    stmts.push(
      db.insert(saleAllocations).values(
        plan.sales.flatMap((s) => s.allocations.map((a) => ({ saleId: s.id, lotId: a.lotId, qty: String(a.qty) }))),
      ),
    );
  }

  if (stmts.length) await db.batch(stmts as [BatchItem<"pg">, ...BatchItem<"pg">[]]);
}
