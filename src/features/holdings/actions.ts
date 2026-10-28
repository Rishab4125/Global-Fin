"use server";

import { randomUUID } from "node:crypto";
import { and, eq, inArray, notExists, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db/client";
import { assets, buyLots, sales, userPlatforms } from "@/db/schema";
import { reallocate, type Lot } from "@/domain/fifo";
import { unitsAt } from "@/domain/corporateActions";
import { limitError } from "@/domain/limits";
import { DEFAULT_PLATFORMS, MAX_PLATFORM_LENGTH } from "@/domain/platform";
import { ASSET_TYPE_IDS, type AssetTypeId } from "@/domain/taxRules";
import { requireUser } from "@/features/auth/session";
import type { ActionState } from "@/features/portfolio/actionState";
import { loadPortfolio, type Portfolio } from "@/features/portfolio/data";
import { allocationStatements, changedAllocations } from "@/features/portfolio/reallocate";
import { money, number, pastDate, qty } from "@/lib/validation";

const iso = pastDate;
const assetType = z.enum(ASSET_TYPE_IDS as [string, ...string[]]);

const buySchema = z.object({
  type: assetType,
  name: z.string().trim().min(1, "Name is required").max(100),
  buyDate: iso,
  qty: qty(),
  price: number("price"),
  fees: money("fees"),
  platform: z.string().trim().min(1).max(MAX_PLATFORM_LENGTH, "Platform name is too long").default("Other"),
});

export async function addBuyAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = buySchema.safeParse({
    type: form.get("type"),
    name: form.get("name"),
    buyDate: form.get("buyDate"),
    qty: form.get("qty"),
    price: form.get("price"),
    fees: form.get("fees") || 0,
    platform: form.get("platform") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const v = parsed.data;
  const tooPrecise = limitError(v.type as AssetTypeId, { qty: v.qty, price: v.price });
  if (tooPrecise) return { error: tooPrecise };

  const existing = await db
    .select({ id: assets.id })
    .from(assets)
    .where(
      and(
        eq(assets.userId, user.id),
        eq(assets.type, v.type),
        sql`lower(${assets.name}) = ${v.name.toLowerCase()}`,
      ),
    )
    .limit(1);

  let assetId = existing[0]?.id;
  if (!assetId) {
    const [created] = await db
      .insert(assets)
      .values({ userId: user.id, type: v.type, name: v.name })
      .returning({ id: assets.id });
    assetId = created.id;
  }

  const lotId = randomUUID();
  const newLot: Lot = { id: lotId, assetId, buyDate: v.buyDate, qty: v.qty, unitPrice: v.price, fees: v.fees, platform: v.platform };
  let moved: ReturnType<typeof allocationStatements> = [];
  if (existing[0]) {
    // A purchase dated before an existing sale becomes that sale's oldest lot, so its matching may change.
    const pfNow = await loadPortfolio(user.id);
    newLot.u = unitsAt(pfNow.actions, assetId, v.buyDate);
    const re = reassign(pfNow, assetId, (lots) => [...lots, newLot]);
    if ("error" in re) return { error: re.error };
    moved = re.statements;
  }
  try {
    await db.batch([
      db.insert(buyLots).values({
        id: lotId,
        userId: user.id,
        assetId,
        buyDate: v.buyDate,
        qty: String(v.qty),
        unitPrice: String(v.price),
        fees: String(v.fees),
        platform: v.platform,
      }),
      // A platform typed here becomes part of the user's own list.
      ...(DEFAULT_PLATFORMS.includes(v.platform)
        ? []
        : [db.insert(userPlatforms).values({ userId: user.id, name: v.platform }).onConflictDoNothing()]),
      ...moved,
    ] as unknown as Parameters<typeof db.batch>[0]);
  } catch {
    return { error: "Couldn't save this purchase. Please try again." };
  }

  revalidatePath("/", "layout");
  return { ok: true, nonce: Date.now() };
}

/** Re-match the sales of a holding after its lots change. Returns the statements to run, or why it can't. */
function reassign(pf: Portfolio, assetId: string, change: (lots: Lot[]) => Lot[]) {
  const assetSales = pf.saleEvents.filter((s) => s.assetId === assetId);
  const { allocations, short } = reallocate(
    change(pf.lots.filter((l) => l.assetId === assetId)),
    assetSales.map((s) => ({ id: s.id, date: s.date, qty: s.qty, u: s.u })),
  );
  if (short) return { error: `This would leave your ${short.date} sale of ${short.qty} units without enough units.` } as const;
  return { statements: allocationStatements(changedAllocations(assetSales, allocations)) } as const;
}

const updateLotSchema = z.object({
  lotId: z.string().uuid(),
  buyDate: iso,
  qty: qty(),
  price: number("price"),
  fees: money("fees"),
});

export async function updateLotAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = updateLotSchema.safeParse({
    lotId: form.get("lotId"),
    buyDate: form.get("buyDate"),
    qty: form.get("qty"),
    price: form.get("price"),
    fees: form.get("fees") || 0,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const v = parsed.data;

  const pf = await loadPortfolio(user.id);
  const lot = pf.lots.find((l) => l.id === v.lotId);
  if (!lot) return { error: "Purchase not found" };
  if (lot.eventId) return { error: "This purchase comes from a bonus event. Reverse the event on the holding page instead." };
  const lotType = pf.assets.find((a) => a.id === lot.assetId)?.type;
  const tooPrecise = lotType && limitError(lotType, { qty: v.qty, price: v.price });
  if (tooPrecise) return { error: tooPrecise };

  const sold = pf.sold.get(lot.id) ?? 0;
  if (v.qty < sold - 1e-9) {
    return { error: `${sold} units from this purchase are already sold, so quantity can't go below that.` };
  }
  const firstSale = pf.saleEvents
    .filter((s) => s.allocations.some((a) => a.lotId === lot.id))
    .map((s) => s.date)
    .sort()[0];
  if (firstSale && v.buyDate > firstSale) {
    return { error: `Purchase date can't be after the first sale from it (${firstSale}).` };
  }

  const re = reassign(pf, lot.assetId, (lots) =>
    lots.map((l) =>
      l.id === lot.id
        ? { ...l, buyDate: v.buyDate, qty: v.qty, unitPrice: v.price, fees: v.fees, u: unitsAt(pf.actions, lot.assetId, v.buyDate) }
        : l,
    ),
  );
  if ("error" in re) return { error: re.error };
  try {
    await db.batch([
      db
        .update(buyLots)
        .set({ buyDate: v.buyDate, qty: String(v.qty), unitPrice: String(v.price), fees: String(v.fees) })
        .where(and(eq(buyLots.id, v.lotId), eq(buyLots.userId, user.id))),
      ...re.statements,
    ] as unknown as Parameters<typeof db.batch>[0]);
  } catch {
    return { error: "Couldn't save this purchase. Please try again." };
  }

  revalidatePath("/", "layout");
  redirect(`/holdings/${lot.assetId}`);
}

export async function deleteLotAction(id: string): Promise<ActionState> {
  const user = await requireUser();
  const pf = await loadPortfolio(user.id);
  const lot = pf.lots.find((l) => l.id === id);
  if (!lot) return { error: "Purchase not found" };
  if (lot.eventId) return { error: "This purchase comes from a bonus event. Reverse the event on the holding page instead." };
  if ((pf.sold.get(lot.id) ?? 0) > 0) {
    return { error: "This purchase has sales against it. Delete or edit those sales first." };
  }

  try {
    // The holding is removed in the same step, but only if nothing else still belongs to it.
    await db.batch([
      db.delete(buyLots).where(and(eq(buyLots.id, id), eq(buyLots.userId, user.id))),
      db.delete(assets).where(
        and(
          eq(assets.id, lot.assetId),
          eq(assets.userId, user.id),
          notExists(db.select({ one: sql`1` }).from(buyLots).where(eq(buyLots.assetId, assets.id))),
          notExists(db.select({ one: sql`1` }).from(sales).where(eq(sales.assetId, assets.id))),
        ),
      ),
    ]);
  } catch {
    return { error: "Couldn't delete this purchase. Please try again." };
  }

  revalidatePath("/", "layout");
  const [stillThere] = await db.select({ id: assets.id }).from(assets).where(and(eq(assets.id, lot.assetId), eq(assets.userId, user.id))).limit(1);
  redirect(stillThere ? `/holdings/${lot.assetId}` : "/holdings");
}

/** Delete whole holdings with everything under them. Sales go first so their allocations clear before the lots. */
export async function deleteHoldingsAction(ids: string[]): Promise<ActionState> {
  const user = await requireUser();
  const parsed = z.array(z.string().uuid()).min(1, "Choose at least one holding.").max(500).safeParse(ids);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  try {
    await db.batch([
      db.delete(sales).where(and(eq(sales.userId, user.id), inArray(sales.assetId, parsed.data))),
      db.delete(assets).where(and(eq(assets.userId, user.id), inArray(assets.id, parsed.data))),
    ]);
  } catch {
    return { error: "Couldn't delete the selected holdings. Please try again." };
  }
  revalidatePath("/", "layout");
  return { ok: true, nonce: Date.now() };
}

const assetSchema = z.object({
  assetId: z.string().uuid(),
  name: z.string().trim().min(1, "Name is required").max(100),
  type: assetType,
});

export async function updateAssetAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = assetSchema.safeParse({
    assetId: form.get("assetId"),
    name: form.get("name"),
    type: form.get("type"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const v = parsed.data;
  const stmts = [
    db
      .update(assets)
      .set({ name: v.name, type: v.type })
      .where(and(eq(assets.id, v.assetId), eq(assets.userId, user.id))),
  ];
  // The tax-free redemption flag only makes sense for gold bonds.
  if (v.type !== "sgb") {
    stmts.push(
      db
        .update(sales)
        .set({ exemptRedemption: false })
        .where(and(eq(sales.assetId, v.assetId), eq(sales.userId, user.id))) as unknown as (typeof stmts)[number],
    );
  }
  try {
    await db.batch(stmts as unknown as Parameters<typeof db.batch>[0]);
  } catch {
    return { error: "Couldn't save changes. Please try again." };
  }
  revalidatePath("/", "layout");
  return { ok: true, nonce: Date.now() };
}
