"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db/client";
import { assets, buyLots, saleAllocations } from "@/db/schema";
import { ASSET_TYPE_IDS } from "@/domain/taxRules";
import { requireUser } from "@/features/auth/session";
import type { ActionState } from "@/features/portfolio/actionState";

const iso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a valid date");

const buySchema = z.object({
  type: z.enum(ASSET_TYPE_IDS as [string, ...string[]]),
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

export async function deleteLotAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const used = await db
    .select({ id: saleAllocations.id })
    .from(saleAllocations)
    .where(eq(saleAllocations.lotId, id))
    .limit(1);
  if (used.length) return; // lots with sales must have their sales deleted first
  await db.delete(buyLots).where(and(eq(buyLots.id, id), eq(buyLots.userId, user.id)));
  revalidatePath("/", "layout");
}
