"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db/client";
import { miscEntries } from "@/db/schema";
import { ASSET_TYPE_IDS } from "@/domain/taxRules";
import { requireUser } from "@/features/auth/session";
import type { ActionState } from "@/features/portfolio/actionState";
import { number, pastDate } from "@/lib/validation";

const schema = z.object({
  assetType: z.enum(["buyback", ...ASSET_TYPE_IDS]),
  entryDate: pastDate,
  amount: number("amount", { min: -1e12 }).refine((n) => n !== 0, "Enter a non-zero amount"),
  kind: z.enum(["profit", "loss"]),
  cost: number("cost"),
  brokerage: number("brokerage"),
  taxAdjusted: z.boolean(),
  term: z.enum(["STCG", "LTCG"]),
  note: z.string().trim().max(200).default(""),
});

export async function addMiscAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = schema.safeParse({
    assetType: form.get("assetType"),
    entryDate: form.get("entryDate"),
    amount: form.get("amount"),
    kind: form.get("kind") || "profit",
    cost: form.get("cost") || 0,
    brokerage: form.get("brokerage") || 0,
    taxAdjusted: form.get("taxAdjusted") === "yes",
    term: form.get("term") || "STCG",
    note: form.get("note") || "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const v = parsed.data;

  // "Share buyback" is one of the investment types; the stored asset_type "buyback" marks the entry.
  const buyback = v.assetType === "buyback";
  if (buyback && v.amount < 0) return { error: "Buyback proceeds must be positive" };
  const signed = buyback ? Math.abs(v.amount) : v.kind === "loss" ? -Math.abs(v.amount) : Math.abs(v.amount);

  await db.insert(miscEntries).values({
    userId: user.id,
    assetType: v.assetType,
    entryDate: v.entryDate,
    amount: String(signed),
    taxAdjusted: v.taxAdjusted,
    term: v.term,
    cost: String(buyback ? v.cost : 0),
    brokerage: String(v.brokerage),
    note: v.note,
  });
  revalidatePath("/", "layout");
  return { ok: true, nonce: Date.now() };
}

export async function deleteMiscAction(id: string): Promise<ActionState> {
  const user = await requireUser();
  try {
    await db.delete(miscEntries).where(and(eq(miscEntries.id, id), eq(miscEntries.userId, user.id)));
  } catch {
    return { error: "Couldn't delete this entry. Please try again." };
  }
  revalidatePath("/", "layout");
  return { ok: true, nonce: Date.now() };
}
