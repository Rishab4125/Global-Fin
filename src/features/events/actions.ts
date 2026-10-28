"use server";

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db/client";
import { buyLots, corporateActions } from "@/db/schema";
import {
  EVENT_TYPES,
  bonusShares,
  isWhole,
  quantityHeldBefore,
  unitsAt,
  withUnits,
  type CorporateAction,
} from "@/domain/corporateActions";
import { reallocate, type Lot } from "@/domain/fifo";
import { qtyDecimals } from "@/domain/limits";
import { requireUser } from "@/features/auth/session";
import type { ActionState } from "@/features/portfolio/actionState";
import { loadPortfolio, type Portfolio } from "@/features/portfolio/data";
import { allocationStatements, changedAllocations } from "@/features/portfolio/reallocate";
import { money, number, pastDate } from "@/lib/validation";

const schema = z.object({
  assetId: z.string().uuid(),
  type: z.enum(["split", "bonus", "dividend"]),
  date: pastDate,
  ratioNew: number("ratio", { min: 1, max: 10000, decimals: 0 }).optional(),
  ratioOld: number("ratio", { min: 1, max: 10000, decimals: 0 }).optional(),
  amount: money("dividend amount", { min: 0 }).optional(),
  tds: money("TDS", { min: 0 }).optional(),
  note: z.string().trim().max(200).default(""),
});

/**
 * Re-match every sale of a holding against its lots under a new set of events. Returns the allocation changes to
 * store, or a message when a sale would be left without enough shares.
 */
function rematch(pf: Portfolio, assetId: string, actions: CorporateAction[], lots: Lot[]) {
  const assetSales = pf.saleEvents.filter((s) => s.assetId === assetId);
  const { allocations, short } = reallocate(
    withUnits(lots, actions),
    assetSales.map((s) => ({ id: s.id, date: s.date, qty: s.qty, u: unitsAt(actions, assetId, s.date) })),
  );
  if (short) {
    return { error: `This would leave your ${short.date} sale of ${short.qty} units without enough shares.` } as const;
  }
  return { statements: allocationStatements(changedAllocations(assetSales, allocations)) } as const;
}

export async function addEventAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = schema.safeParse({
    assetId: form.get("assetId"),
    type: form.get("type"),
    date: form.get("date"),
    ratioNew: form.get("ratioNew") || undefined,
    ratioOld: form.get("ratioOld") || undefined,
    amount: form.get("amount") || undefined,
    tds: form.get("tds") || undefined,
    note: form.get("note") || "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const v = parsed.data;

  const pf = await loadPortfolio(user.id);
  const asset = pf.assets.find((a) => a.id === v.assetId);
  if (!asset) return { error: "Holding not found" };
  if (!EVENT_TYPES[asset.type]?.includes(v.type)) {
    return { error: `A ${v.type} can't be recorded on this type of holding.` };
  }
  if (pf.actions.some((a) => a.assetId === asset.id && a.type === v.type && a.date === v.date && v.type !== "dividend")) {
    return { error: `A ${v.type} on ${v.date} is already recorded. Reverse it first to change it.` };
  }

  const assetLots = pf.lots.filter((l) => l.assetId === asset.id);
  const id = randomUUID();
  const action: CorporateAction = {
    id,
    assetId: asset.id,
    type: v.type,
    date: v.date,
    ratioNew: v.ratioNew ?? 1,
    ratioOld: v.ratioOld ?? 1,
    amount: v.amount ?? 0,
    tds: v.tds ?? 0,
    note: v.note,
  };

  let bonusLot: Lot | null = null;
  if (v.type === "dividend") {
    if (!v.amount || v.amount <= 0) return { error: "Enter the dividend amount" };
    if ((v.tds ?? 0) > v.amount) return { error: "TDS can't be more than the dividend" };
  } else {
    if (!v.ratioNew || !v.ratioOld) return { error: "Enter the ratio" };
    const held = quantityHeldBefore(assetLots, pf.saleEvents, pf.actions, asset.id, v.date);
    if (held <= 0) return { error: `You held no shares of ${asset.name} before ${v.date}.` };

    if (v.type === "split") {
      if (v.ratioNew === v.ratioOld) return { error: "The ratio doesn't change anything" };
      if (qtyDecimals(asset.type) === 0 && !isWhole((held * v.ratioNew) / v.ratioOld)) {
        return {
          error: `${held} shares at ${v.ratioOld}:${v.ratioNew} leaves a fraction. Shares are whole units, so record the cash-settled part as a sale.`,
        };
      }
    } else {
      const qty = bonusShares(held, v.ratioNew, v.ratioOld);
      if (qty < 1) return { error: `${held} shares earn less than one bonus share at ${v.ratioNew}:${v.ratioOld}.` };
      const platformLot = [...assetLots].filter((l) => l.buyDate < v.date).sort((a, b) => (a.buyDate < b.buyDate ? 1 : -1))[0];
      bonusLot = {
        id: randomUUID(),
        assetId: asset.id,
        buyDate: v.date,
        qty,
        unitPrice: 0,
        fees: 0,
        source: "bonus",
        platform: platformLot?.platform ?? "Other",
        eventId: id,
      };
    }
  }

  const actions = [...pf.actions, action];
  const re = rematch(pf, asset.id, actions, bonusLot ? [...assetLots, bonusLot] : assetLots);
  if ("error" in re) return { error: re.error };

  const stmts: BatchItem<"pg">[] = [
    db.insert(corporateActions).values({
      id,
      userId: user.id,
      assetId: asset.id,
      type: v.type,
      actionDate: v.date,
      ratioNew: String(action.ratioNew),
      ratioOld: String(action.ratioOld),
      amount: String(action.amount),
      tds: String(action.tds),
      note: v.note,
    }),
  ];
  if (bonusLot) {
    stmts.push(
      db.insert(buyLots).values({
        id: bonusLot.id,
        userId: user.id,
        assetId: asset.id,
        buyDate: bonusLot.buyDate,
        qty: String(bonusLot.qty),
        unitPrice: "0",
        fees: "0",
        platform: bonusLot.platform ?? "Other",
        source: "bonus",
        eventId: id,
      }),
    );
  }
  stmts.push(...re.statements);
  try {
    await db.batch(stmts as [BatchItem<"pg">, ...BatchItem<"pg">[]]);
  } catch {
    return { error: "Couldn't save this event. Please try again." };
  }

  revalidatePath("/", "layout");
  return { ok: true, nonce: Date.now() };
}

/** Reverse an event. A bonus also removes the shares it created, unless a sale already uses them. */
export async function deleteEventAction(id: string): Promise<ActionState> {
  const user = await requireUser();
  const pf = await loadPortfolio(user.id);
  const action = pf.actions.find((a) => a.id === id);
  if (!action) return { error: "Event not found" };

  const bonusLot = pf.lots.find((l) => l.eventId === id);
  if (bonusLot && (pf.sold.get(bonusLot.id) ?? 0) > 0) {
    return { error: "Some bonus shares are already sold. Delete or edit those sales first." };
  }

  const actions = pf.actions.filter((a) => a.id !== id);
  const lots = pf.lots.filter((l) => l.assetId === action.assetId && l.id !== bonusLot?.id);
  const re = rematch(pf, action.assetId, actions, lots);
  if ("error" in re) return { error: re.error };

  try {
    // Allocations are re-pointed first; deleting the event then removes its bonus lot.
    await db.batch([
      ...re.statements,
      db.delete(corporateActions).where(and(eq(corporateActions.id, id), eq(corporateActions.userId, user.id))),
    ] as unknown as Parameters<typeof db.batch>[0]);
  } catch {
    return { error: "Couldn't reverse this event. Please try again." };
  }

  revalidatePath("/", "layout");
  return { ok: true, nonce: Date.now() };
}
