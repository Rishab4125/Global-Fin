import { and, eq, inArray, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { db } from "@/db/client";
import { buyLots, saleAllocations, sales } from "@/db/schema";
import { reallocate, type Allocation } from "@/domain/fifo";

/** Statements that replace the stored allocations of these sales. Append them to the batch that changes the data. */
export function allocationStatements(allocations: Map<string, Allocation[]>): BatchItem<"pg">[] {
  const saleIds = [...allocations.keys()];
  if (!saleIds.length) return [];
  const rows = [...allocations].flatMap(([saleId, list]) =>
    list.map((a) => ({ saleId, lotId: a.lotId, qty: String(a.qty) })),
  );
  const stmts: BatchItem<"pg">[] = [db.delete(saleAllocations).where(inArray(saleAllocations.saleId, saleIds))];
  if (rows.length) stmts.push(db.insert(saleAllocations).values(rows));
  return stmts;
}

/**
 * Re-match every sale of a holding from what is stored now. Used to repair a holding after a concurrent change.
 * Returns the id of the first sale left without enough units, or null when everything matched.
 */
export async function rebuildAssetAllocations(userId: string, assetId: string): Promise<string | null> {
  const [lotRows, saleRows] = await Promise.all([
    db.select().from(buyLots).where(and(eq(buyLots.userId, userId), eq(buyLots.assetId, assetId))),
    db.select().from(sales).where(and(eq(sales.userId, userId), eq(sales.assetId, assetId))).orderBy(sales.createdAt),
  ]);
  const { allocations, short } = reallocate(
    lotRows.map((l) => ({
      id: l.id,
      assetId: l.assetId,
      buyDate: l.buyDate,
      qty: Number(l.qty),
      unitPrice: Number(l.unitPrice),
      fees: Number(l.fees),
    })),
    saleRows.map((s) => ({ id: s.id, date: s.sellDate, qty: Number(s.qty) })),
  );
  if (short) return short.id;
  const stmts = allocationStatements(allocations);
  if (stmts.length) await db.batch(stmts as [BatchItem<"pg">, ...BatchItem<"pg">[]]);
  return null;
}

/** True when some lot of this holding has more units allocated to sales than it was bought with. */
export async function isOversold(userId: string, assetId: string): Promise<boolean> {
  const [lotRows, totals] = await Promise.all([
    db.select({ id: buyLots.id, qty: buyLots.qty }).from(buyLots).where(and(eq(buyLots.userId, userId), eq(buyLots.assetId, assetId))),
    db
      .select({ lotId: saleAllocations.lotId, total: sql<string>`sum(${saleAllocations.qty})` })
      .from(saleAllocations)
      .innerJoin(sales, eq(sales.id, saleAllocations.saleId))
      .where(and(eq(sales.userId, userId), eq(sales.assetId, assetId)))
      .groupBy(saleAllocations.lotId),
  ]);
  const bought = new Map(lotRows.map((l) => [l.id, Number(l.qty)]));
  return totals.some((t) => Number(t.total) > (bought.get(t.lotId) ?? 0) + 1e-6);
}

/** The sales whose stored allocations differ from the freshly computed ones. */
export function changedAllocations(
  current: { id: string; allocations: Allocation[] }[],
  next: Map<string, Allocation[]>,
): Map<string, Allocation[]> {
  const changed = new Map<string, Allocation[]>();
  for (const s of current) {
    const n = next.get(s.id);
    if (n && JSON.stringify(n) !== JSON.stringify(s.allocations)) changed.set(s.id, n);
  }
  return changed;
}
