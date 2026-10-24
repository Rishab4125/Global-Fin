"use server";

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db/client";
import { sales, saleAllocations } from "@/db/schema";
import { allocateFifo } from "@/domain/fifo";
import { computeRealised, type SaleEvent } from "@/domain/gains";
import { requireUser } from "@/features/auth/session";
import type { ActionState } from "@/features/portfolio/actionState";
import { loadPortfolio } from "@/features/portfolio/data";

const saleSchema = z.object({
  assetId: z.string().uuid(),
  saleId: z.string().uuid().optional(),
  sellDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a valid date"),
  qty: z.coerce.number().positive("Quantity must be positive"),
  price: z.coerce.number().min(0, "Price cannot be negative"),
  fees: z.coerce.number().min(0).default(0),
  applyTax: z.boolean(),
  exemptRedemption: z.boolean(),
  isBuyback: z.boolean(),
});

function parse(form: FormData) {
  return saleSchema.safeParse({
    assetId: form.get("assetId"),
    saleId: form.get("saleId") || undefined,
    sellDate: form.get("sellDate"),
    qty: form.get("qty"),
    price: form.get("price"),
    fees: form.get("fees") || 0,
    applyTax: form.get("applyTax") === "yes",
    exemptRedemption: form.get("exemptRedemption") === "on",
    isBuyback: form.get("isBuyback") === "on",
  });
}

/** Match the sale to lots and compute its tax. When editing, the existing sale is treated as absent. */
async function plan(userId: string, form: FormData) {
  const parsed = parse(form);
  if (!parsed.success) return { error: parsed.error.issues[0].message } as const;
  const v = parsed.data;

  const pf = await loadPortfolio(userId);
  const asset = pf.assets.find((a) => a.id === v.assetId);
  if (!asset) return { error: "Holding not found" } as const;

  const existing = v.saleId ? pf.saleEvents.find((s) => s.id === v.saleId) : undefined;
  if (v.saleId && (!existing || existing.assetId !== asset.id)) return { error: "Sale not found" } as const;

  const sold = new Map(pf.sold);
  for (const a of existing?.allocations ?? []) sold.set(a.lotId, (sold.get(a.lotId) ?? 0) - a.qty);

  const assetLots = pf.lots.filter((l) => l.assetId === asset.id);
  const remaining = new Map(assetLots.map((l) => [l.id, l.qty - (sold.get(l.id) ?? 0)]));
  const { allocations, shortfall } = allocateFifo(assetLots, remaining, v.qty, v.sellDate);
  if (shortfall > 1e-9) {
    const have = v.qty - shortfall;
    return {
      error: `Only ${have} units available to sell on or before ${v.sellDate}`,
    } as const;
  }

  const hypo: SaleEvent = {
    kind: "sale",
    id: "preview",
    assetId: asset.id,
    assetName: asset.name,
    assetType: asset.type,
    date: v.sellDate,
    qty: v.qty,
    price: v.price,
    fees: v.fees,
    applyTax: v.applyTax,
    exemptRedemption: asset.type === "sgb" && v.exemptRedemption,
    buyback: v.isBuyback,
    allocations,
  };
  const others = pf.saleEvents.filter((s) => s.id !== v.saleId);
  const rows = computeRealised([...others, ...pf.miscEvents, hypo], pf.lots, pf.slabRate);
  const row = rows.find((r) => r.id === "preview")!;
  return { v, hypo, row, others, pf } as const;
}

export async function previewSaleAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const p = await plan(user.id, form);
  if ("error" in p) return { error: p.error };
  let taxIfApplied: number | undefined;
  if (!p.hypo.applyTax) {
    const again = computeRealised(
      [...p.others, ...p.pf.miscEvents, { ...p.hypo, applyTax: true }],
      p.pf.lots,
      p.pf.slabRate,
    );
    taxIfApplied = again.find((r) => r.id === "preview")?.tax;
  }
  return { preview: p.row, taxIfApplied };
}

export async function recordSaleAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const p = await plan(user.id, form);
  if ("error" in p) return { error: p.error };

  const saleId = randomUUID();
  await db.batch([
    db.insert(sales).values({
      id: saleId,
      userId: user.id,
      assetId: p.v.assetId,
      sellDate: p.v.sellDate,
      qty: String(p.v.qty),
      price: String(p.v.price),
      fees: String(p.v.fees),
      applyTax: p.v.applyTax,
      exemptRedemption: p.hypo.exemptRedemption,
      isBuyback: p.v.isBuyback,
    }),
    db.insert(saleAllocations).values(
      p.hypo.allocations.map((a) => ({ saleId, lotId: a.lotId, qty: String(a.qty) })),
    ),
  ]);

  revalidatePath("/", "layout");
  redirect("/realised");
}

export async function updateSaleAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const p = await plan(user.id, form);
  if ("error" in p) return { error: p.error };
  const saleId = p.v.saleId;
  if (!saleId) return { error: "Sale not found" };

  await db.batch([
    db
      .update(sales)
      .set({
        sellDate: p.v.sellDate,
        qty: String(p.v.qty),
        price: String(p.v.price),
        fees: String(p.v.fees),
        applyTax: p.v.applyTax,
        exemptRedemption: p.hypo.exemptRedemption,
        isBuyback: p.v.isBuyback,
      })
      .where(and(eq(sales.id, saleId), eq(sales.userId, user.id))),
    db.delete(saleAllocations).where(eq(saleAllocations.saleId, saleId)),
    db.insert(saleAllocations).values(
      p.hypo.allocations.map((a) => ({ saleId, lotId: a.lotId, qty: String(a.qty) })),
    ),
  ]);

  revalidatePath("/", "layout");
  redirect(`/holdings/${p.v.assetId}`);
}

export async function deleteSaleAction(id: string): Promise<ActionState> {
  const user = await requireUser();
  const [sale] = await db
    .select({ assetId: sales.assetId })
    .from(sales)
    .where(and(eq(sales.id, id), eq(sales.userId, user.id)))
    .limit(1);
  if (!sale) return { error: "Sale not found" };
  await db.delete(sales).where(and(eq(sales.id, id), eq(sales.userId, user.id)));
  revalidatePath("/", "layout");
  redirect(`/holdings/${sale.assetId}`);
}
