"use server";

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db/client";
import { sales } from "@/db/schema";
import { reallocate, type Allocation } from "@/domain/fifo";
import { computeRealised, type SaleEvent } from "@/domain/gains";
import { unitsAt } from "@/domain/corporateActions";
import { limitError } from "@/domain/limits";
import { requireUser } from "@/features/auth/session";
import type { ActionState } from "@/features/portfolio/actionState";
import { loadPortfolio } from "@/features/portfolio/data";
import { allocationStatements, isOversold, rebuildAssetAllocations } from "@/features/portfolio/reallocate";
import { money, number, pastDate, qty } from "@/lib/validation";

const NEW_SALE = "preview";

const saleSchema = z.object({
  assetId: z.string().uuid(),
  saleId: z.string().uuid().optional(),
  sellDate: pastDate,
  qty: qty(),
  price: number("price"),
  fees: money("fees"),
  applyTax: z.boolean(),
  exemptRedemption: z.boolean(),
  isBuyback: z.boolean(),
  /** Shares tendered in a buyback. `qty` is the accepted part, the only part that becomes a sale. */
  tenderedQty: qty("tendered shares").optional(),
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
    tenderedQty: form.get("tenderedQty") || undefined,
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
  const tooPrecise = limitError(asset.type, { qty: v.qty, price: v.price });
  if (tooPrecise) return { error: tooPrecise } as const;
  if (v.isBuyback) {
    if (v.tenderedQty === undefined) return { error: "Enter the shares you tendered in the buyback" } as const;
    const tenderedTooPrecise = limitError(asset.type, { qty: v.tenderedQty });
    if (tenderedTooPrecise) return { error: tenderedTooPrecise } as const;
    if (v.qty > v.tenderedQty) return { error: "Accepted shares can't be more than the shares tendered" } as const;
  }
  const sellU = unitsAt(pf.actions, asset.id, v.sellDate);

  const existing = v.saleId ? pf.saleEvents.find((s) => s.id === v.saleId) : undefined;
  if (v.saleId && (!existing || existing.assetId !== asset.id)) return { error: "Sale not found" } as const;

  // Replay every sale of this holding oldest first, so a back-dated sale takes the right lots and any
  // existing sale that has to shift to other lots is re-matched too.
  const assetLots = pf.lots.filter((l) => l.assetId === asset.id);
  const assetSales = pf.saleEvents.filter((s) => s.assetId === asset.id && s.id !== v.saleId);
  const { allocations: matched, short, shortBy } = reallocate(assetLots, [
    ...assetSales.map((s) => ({ id: s.id, date: s.date, qty: s.qty, u: s.u })),
    { id: NEW_SALE, date: v.sellDate, qty: v.qty, u: sellU },
  ]);
  if (short) {
    if (short.id !== NEW_SALE) {
      return { error: `This would leave your ${short.date} sale of ${short.qty} units without enough units.` } as const;
    }
    const have = Math.max(0, v.qty - shortBy);
    return { error: `Only ${have} units available to sell on or before ${v.sellDate}` } as const;
  }
  const allocations = matched.get(NEW_SALE)!;
  const reassigned = new Map<string, Allocation[]>();
  for (const s of assetSales) {
    const next = matched.get(s.id)!;
    if (JSON.stringify(next) !== JSON.stringify(s.allocations)) reassigned.set(s.id, next);
  }

  const hypo: SaleEvent = {
    kind: "sale",
    id: NEW_SALE,
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
    tenderedQty: v.isBuyback ? (v.tenderedQty ?? null) : null,
    u: sellU,
    allocations,
  };
  const others = pf.saleEvents
    .filter((s) => s.id !== v.saleId)
    .map((s) => (reassigned.has(s.id) ? { ...s, allocations: reassigned.get(s.id)! } : s));
  const rows = computeRealised([...others, ...pf.miscEvents, hypo], pf.lots, pf.slabRate);
  const row = rows.find((r) => r.id === "preview")!;
  return { v, hypo, row, others, pf, reassigned } as const;
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
  const mine = new Map(p.reassigned).set(saleId, p.hypo.allocations);
  try {
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
        tenderedQty: p.hypo.tenderedQty == null ? null : String(p.hypo.tenderedQty),
      }),
      ...allocationStatements(mine),
    ] as unknown as Parameters<typeof db.batch>[0]);
  } catch {
    return { error: "Couldn't save this sale. Please try again." };
  }

  // Two sales submitted at once can both see the same free units. If that happened, undo this one.
  if (await isOversold(user.id, p.v.assetId)) {
    await db.delete(sales).where(and(eq(sales.id, saleId), eq(sales.userId, user.id)));
    await rebuildAssetAllocations(user.id, p.v.assetId);
    return { error: "Those units were just used by another sale. Review your holding and try again." };
  }

  revalidatePath("/", "layout");
  redirect("/gains");
}

export async function updateSaleAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const p = await plan(user.id, form);
  if ("error" in p) return { error: p.error };
  const saleId = p.v.saleId;
  if (!saleId) return { error: "Sale not found" };

  const mine = new Map(p.reassigned).set(saleId, p.hypo.allocations);
  try {
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
          tenderedQty: p.hypo.tenderedQty == null ? null : String(p.hypo.tenderedQty),
        })
        .where(and(eq(sales.id, saleId), eq(sales.userId, user.id))),
      ...allocationStatements(mine),
    ] as unknown as Parameters<typeof db.batch>[0]);
  } catch {
    return { error: "Couldn't save this sale. Please try again." };
  }

  revalidatePath("/", "layout");
  redirect(`/holdings/${p.v.assetId}`);
}

export async function deleteSaleAction(id: string): Promise<ActionState> {
  const user = await requireUser();
  const pf = await loadPortfolio(user.id);
  const sale = pf.saleEvents.find((s) => s.id === id);
  if (!sale) return { error: "Sale not found" };

  // Without this sale, later sales may now be matched to older lots.
  const rest = pf.saleEvents.filter((s) => s.assetId === sale.assetId && s.id !== id);
  const { allocations, short } = reallocate(
    pf.lots.filter((l) => l.assetId === sale.assetId),
    rest.map((s) => ({ id: s.id, date: s.date, qty: s.qty, u: s.u })),
  );
  if (short) return { error: "Couldn't re-match your other sales after this delete." };

  try {
    await db.batch([
      db.delete(sales).where(and(eq(sales.id, id), eq(sales.userId, user.id))),
      ...allocationStatements(allocations),
    ] as unknown as Parameters<typeof db.batch>[0]);
  } catch {
    return { error: "Couldn't delete this sale. Please try again." };
  }
  revalidatePath("/", "layout");
  redirect(`/holdings/${sale.assetId}`);
}
