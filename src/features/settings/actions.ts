"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db/client";
import { userSettings } from "@/db/schema";
import { requireUser } from "@/features/auth/session";
import type { ActionState } from "@/features/portfolio/actionState";

const schema = z.coerce.number().min(0, "Rate must be 0-45").max(45, "Rate must be 0-45");

export async function saveSlabAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = schema.safeParse(form.get("slabPercent"));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const rate = String(parsed.data / 100);
  await db
    .insert(userSettings)
    .values({ userId: user.id, slabRate: rate })
    .onConflictDoUpdate({ target: userSettings.userId, set: { slabRate: rate } });
  revalidatePath("/", "layout");
  return { ok: true, nonce: Date.now() };
}
