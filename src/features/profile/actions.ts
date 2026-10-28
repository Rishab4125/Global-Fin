"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { signOut } from "@/auth";
import { db } from "@/db/client";
import {
  assets,
  brokerConnections,
  buyLots,
  miscEntries,
  sales,
  userPlatforms,
  userSettings,
} from "@/db/schema";
import { DEFAULT_PLATFORMS, MAX_PLATFORM_LENGTH } from "@/domain/platform";
import { requireUser } from "@/features/auth/session";
import type { ActionState } from "@/features/portfolio/actionState";

const done = (): ActionState => ({ ok: true, nonce: Date.now() });

const platformSchema = z.object({
  name: z.string().trim().min(1, "Enter a name").max(MAX_PLATFORM_LENGTH, `Keep it under ${MAX_PLATFORM_LENGTH} characters`),
  kind: z.enum(["broker", "bank", "self"]),
});

export async function addPlatformAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = platformSchema.safeParse({ name: form.get("name"), kind: form.get("kind") || "broker" });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { name, kind } = parsed.data;
  if (DEFAULT_PLATFORMS.some((p) => p.toLowerCase() === name.toLowerCase())) {
    return { error: `${name} is already in your list.` };
  }
  const existing = await db.select({ name: userPlatforms.name }).from(userPlatforms).where(eq(userPlatforms.userId, user.id));
  if (existing.some((p) => p.name.toLowerCase() === name.toLowerCase())) return { error: `${name} is already in your list.` };
  await db.insert(userPlatforms).values({ userId: user.id, name, kind });
  revalidatePath("/", "layout");
  return done();
}

/** Remove a platform you added, as long as no purchase is held there. The built-in ones stay. */
export async function deletePlatformAction(name: string): Promise<ActionState> {
  const user = await requireUser();
  if (DEFAULT_PLATFORMS.includes(name)) return { error: "Built-in platforms can't be removed." };
  const [used] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(buyLots)
    .where(and(eq(buyLots.userId, user.id), eq(buyLots.platform, name)));
  if (used.n > 0) {
    return { error: `${used.n} purchase${used.n === 1 ? " is" : "s are"} held on ${name}. Move them to another platform first.` };
  }
  await db.delete(userPlatforms).where(and(eq(userPlatforms.userId, user.id), eq(userPlatforms.name, name)));
  revalidatePath("/", "layout");
  return done();
}

const tagName = z.string().trim().min(1, "Enter a tag").max(30, "Keep tags under 30 characters").refine((t) => !t.includes(","), "Tags can't contain commas");

export async function renameTagAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const from = tagName.safeParse(form.get("from"));
  const to = tagName.safeParse(form.get("to"));
  if (!from.success || !to.success) return { error: (!to.success ? to : from).error!.issues[0].message };
  // Renaming onto an existing tag merges the two without repeating it on a holding.
  await db.execute(sql`
    update assets
    set tags = coalesce((select array_agg(distinct t) from unnest(array_replace(tags, ${from.data}, ${to.data})) as t), '{}')
    where user_id = ${user.id} and ${from.data} = any(tags)
  `);
  revalidatePath("/", "layout");
  return done();
}

export async function deleteTagAction(tag: string): Promise<ActionState> {
  const user = await requireUser();
  await db.execute(sql`update assets set tags = array_remove(tags, ${tag}) where user_id = ${user.id} and ${tag} = any(tags)`);
  revalidatePath("/", "layout");
  return done();
}

/** Delete everything stored for this account, then sign out. Asks for the word DELETE so it can't happen by accident. */
export async function deleteAllDataAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (String(form.get("confirm") ?? "").trim() !== "DELETE") return { error: "Type DELETE to confirm." };
  try {
    // Sales go first so their allocations clear before the purchases; the rest of a holding's rows follow it.
    await db.batch([
      db.delete(sales).where(eq(sales.userId, user.id)),
      db.delete(assets).where(eq(assets.userId, user.id)),
      db.delete(miscEntries).where(eq(miscEntries.userId, user.id)),
      db.delete(userPlatforms).where(eq(userPlatforms.userId, user.id)),
      db.delete(brokerConnections).where(eq(brokerConnections.userId, user.id)),
      db.delete(userSettings).where(eq(userSettings.userId, user.id)),
    ]);
  } catch {
    return { error: "Couldn't delete your data. Nothing was changed. Please try again." };
  }
  await signOut({ redirectTo: "/login" });
  return done();
}
