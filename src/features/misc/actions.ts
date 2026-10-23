"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db/client";
import { miscEntries } from "@/db/schema";
import { ASSET_TYPE_IDS } from "@/domain/taxRules";
import { requireUser } from "@/features/auth/session";
import type { ActionState } from "@/features/portfolio/actionState";

const schema = z.object({
  entryType: z.enum(["general", "buyback"]),
  assetType: z.enum(ASSET_TYPE_IDS as [string, ...string[]]),
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a valid date"),
  amount: z.coerce.number().refine((n) => Number.isFinite(n) && n !== 0, "Enter a non-zero amount"),
  kind: z.enum(["profit", "loss"]),
  cost: z.coerce.number().min(0, "Cost cannot be negative").default(0),
  brokerage: z.coerce.number().min(0, "Brokerage cannot be negative").default(0),
  taxAdjusted: z.boolean(),
  term: z.enum(["STCG", "LTCG"]),
  note: z.string().trim().max(200).default(""),
});

export async function addMiscAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = schema.safeParse({
    entryType: form.get("entryType") || "general",
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

  const buyback = v.entryType === "buyback";
  if (buyback && v.amount < 0) return { error: "Buyback proceeds must be positive" };
  const signed = buyback ? Math.abs(v.amount) : v.kind === "loss" ? -Math.abs(v.amount) : Math.abs(v.amount);

  await db.insert(miscEntries).values({
    userId: user.id,
    assetType: v.assetType,
    entryDate: v.entryDate,
    amount: String(signed),
    taxAdjusted: v.taxAdjusted,
    term: v.term,
    entryType: v.entryType,
    cost: String(buyback ? v.cost : 0),
    brokerage: String(v.brokerage),
    note: v.note,
  });
  revalidatePath("/", "layout");
  return { ok: true, nonce: Date.now() };
}

export async function deleteMiscAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  await db.delete(miscEntries).where(and(eq(miscEntries.id, id), eq(miscEntries.userId, user.id)));
  revalidatePath("/", "layout");
}
