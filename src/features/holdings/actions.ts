"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db/client";
import { assets, buyLots } from "@/db/schema";
import { ASSET_TYPE_IDS } from "@/domain/taxRules";
import { requireUser } from "@/features/auth/session";
import type { ActionState } from "@/features/portfolio/actionState";
import { loadPortfolio } from "@/features/portfolio/data";

const iso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a valid date");
const assetType = z.enum(ASSET_TYPE_IDS as [string, ...string[]]);

const buySchema = z.object({
  type: assetType,
  name: z.string().trim().min(1, "Name is required").max(100),
  buyDate: iso,
  qty: z.coerce.number().positive("Quantity must be positive"),
  price: z.coerce.number().min(0, "Price cannot be negative"),
  fees: z.coerce.number().min(0).default(0),
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
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const v = parsed.data;

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

  await db.insert(buyLots).values({
    userId: user.id,
    assetId,
    buyDate: v.buyDate,
    qty: String(v.qty),
    unitPrice: String(v.price),
    fees: String(v.fees),
  });

  revalidatePath("/", "layout");
  return { ok: true, nonce: Date.now() };
}

const updateLotSchema = z.object({
  lotId: z.string().uuid(),
  buyDate: iso,
  qty: z.coerce.number().positive("Quantity must be positive"),
  price: z.coerce.number().min(0, "Price cannot be negative"),
  fees: z.coerce.number().min(0).default(0),
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

  await db
    .update(buyLots)
    .set({ buyDate: v.buyDate, qty: String(v.qty), unitPrice: String(v.price), fees: String(v.fees) })
    .where(and(eq(buyLots.id, v.lotId), eq(buyLots.userId, user.id)));

  revalidatePath("/", "layout");
  redirect(`/holdings/${lot.assetId}`);
}

export async function deleteLotAction(id: string): Promise<ActionState> {
  const user = await requireUser();
  const pf = await loadPortfolio(user.id);
  const lot = pf.lots.find((l) => l.id === id);
  if (!lot) return { error: "Purchase not found" };
  if ((pf.sold.get(lot.id) ?? 0) > 0) {
    return { error: "This purchase has sales against it. Delete or edit those sales first." };
  }

  await db.delete(buyLots).where(and(eq(buyLots.id, id), eq(buyLots.userId, user.id)));

  const othersLeft = pf.lots.some((l) => l.assetId === lot.assetId && l.id !== id);
  const hasSales = pf.saleEvents.some((s) => s.assetId === lot.assetId);
  revalidatePath("/", "layout");
  if (!othersLeft && !hasSales) {
    await db.delete(assets).where(and(eq(assets.id, lot.assetId), eq(assets.userId, user.id)));
    redirect("/holdings");
  }
  redirect(`/holdings/${lot.assetId}`);
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
  await db
    .update(assets)
    .set({ name: v.name, type: v.type })
    .where(and(eq(assets.id, v.assetId), eq(assets.userId, user.id)));
  revalidatePath("/", "layout");
  return { ok: true, nonce: Date.now() };
}
