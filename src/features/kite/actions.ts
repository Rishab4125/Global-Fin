"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db/client";
import { brokerConnections } from "@/db/schema";
import { diffHoldings, type AppPosition } from "@/domain/brokerSync";
import { todayIso } from "@/domain/dates";
import { computeHoldings } from "@/domain/fifo";
import { requireUser } from "@/features/auth/session";
import { buildPlan, resolveAssets } from "@/features/import/plan";
import { executePlan, loadUserState, type UserState } from "@/features/import/server";
import type { BrokerTrade } from "@/features/import/types";
import { toPreview } from "@/features/import/view";
import type { ActionState } from "@/features/portfolio/actionState";
import { decryptToken, encryptToken } from "./crypto";
import { fetchHoldings, KiteAuthError } from "./client";
import { credsOf, loadConnection, tokenValid } from "./connection";

const SOURCE = "kite_sync";
const RECONNECT = "Your Zerodha session has expired. Reconnect Zerodha and try again.";

function mappingFrom(form: FormData) {
  const mapping = new Map<string, string>();
  for (const [name, value] of form.entries()) {
    if (typeof value === "string" && value && name.startsWith("map:")) mapping.set(name.slice(4), value);
  }
  return mapping;
}

function appQuantities(state: UserState) {
  const sold = new Map<string, number>();
  for (const s of state.sales) for (const a of s.allocations) sold.set(a.lotId, (sold.get(a.lotId) ?? 0) + a.qty);
  return computeHoldings(state.lots, sold);
}

async function makePlan(userId: string, form: FormData) {
  const conn = await loadConnection(userId);
  const creds = conn && credsOf(conn);
  if (!conn || !creds || !tokenValid(conn)) return { error: RECONNECT } as const;

  let holdings;
  try {
    holdings = await fetchHoldings(creds, decryptToken(conn.accessTokenEnc!));
  } catch (e) {
    return { error: e instanceof KiteAuthError ? RECONNECT : "Could not reach Zerodha. Try again in a moment." } as const;
  }

  const state = await loadUserState(userId);
  const mapping = mappingFrom(form);
  const matches = resolveAssets(
    holdings.map((h) => ({ isin: h.isin, symbol: h.symbol, name: h.symbol })),
    state.assets,
    mapping,
  );
  const matchByIsin = new Map(matches.map((m) => [m.key, m]));
  const held = appQuantities(state);

  const positions: AppPosition[] = [];
  const linked = new Set<string>();
  for (const h of holdings) {
    const m = matchByIsin.get(h.isin);
    if (m?.assetId) {
      linked.add(m.assetId);
      positions.push({ isin: h.isin, symbol: h.symbol, qty: held.get(m.assetId)?.qty ?? 0 });
    }
  }
  for (const a of state.assets) {
    if (!a.isin || linked.has(a.id)) continue;
    const qty = held.get(a.id)?.qty ?? 0;
    if (qty > 0) positions.push({ isin: a.isin, symbol: a.name, qty });
  }

  const assetByIsin = new Map(state.assets.filter((a) => a.isin).map((a) => [a.isin as string, a]));
  const today = todayIso();
  const trades: BrokerTrade[] = diffHoldings(holdings, positions).map((a) => {
    let price = a.price;
    if (a.kind === "reduce" && price <= 0) {
      const id = assetByIsin.get(a.isin)?.id;
      price = (id && held.get(id)?.avgCost) || 0;
    }
    return {
      isin: a.isin,
      symbol: a.symbol,
      name: a.symbol,
      date: today,
      side: a.kind === "add" ? "buy" : "sell",
      qty: a.qty,
      price,
      tradeId: null,
    };
  });

  const plan = buildPlan({
    trades,
    source: SOURCE,
    ...state,
    mapping,
    includeDuplicates: new Set(),
    replaceEstimated: false,
  });
  return { plan, state, holdingCount: holdings.length } as const;
}

export async function previewSyncAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const r = await makePlan(user.id, form);
  if ("error" in r) return { error: r.error };
  return { importPreview: toPreview("sync", r.plan, r.state.assets, []) };
}

export async function commitSyncAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const r = await makePlan(user.id, form);
  if ("error" in r) return { error: r.error };

  try {
    await executePlan(user.id, SOURCE, r.plan);
    await db
      .update(brokerConnections)
      .set({ lastSyncAt: new Date() })
      .where(and(eq(brokerConnections.userId, user.id), eq(brokerConnections.broker, "kite")));
  } catch {
    return { error: "Sync failed and nothing was saved. Try again." };
  }

  revalidatePath("/", "layout");
  return {
    ok: true,
    nonce: Date.now(),
    importDone: {
      buys: r.plan.lots.length,
      sells: r.plan.sales.length,
      skipped: 0,
      failed: r.plan.rows.filter((x) => x.status === "error").length,
    },
  };
}

export async function disconnectKiteAction(): Promise<ActionState> {
  const user = await requireUser();
  await db
    .delete(brokerConnections)
    .where(and(eq(brokerConnections.userId, user.id), eq(brokerConnections.broker, "kite")));
  revalidatePath("/", "layout");
  return { ok: true, nonce: Date.now() };
}

const credsSchema = z.object({
  apiKey: z.string().trim().regex(/^[A-Za-z0-9]{8,64}$/, "That doesn't look like a Kite API key"),
  apiSecret: z.string().trim().regex(/^[A-Za-z0-9]{8,64}$/, "That doesn't look like a Kite API secret"),
});

export async function saveKiteCredentialsAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = credsSchema.safeParse({ apiKey: form.get("apiKey"), apiSecret: form.get("apiSecret") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  let secretEnc: string;
  try {
    secretEnc = encryptToken(parsed.data.apiSecret);
  } catch {
    return { error: "Zerodha sync isn't set up on this server yet." };
  }
  const values = {
    apiKey: parsed.data.apiKey,
    apiSecretEnc: secretEnc,
    accessTokenEnc: null,
    tokenExpiresAt: null,
  };
  await db
    .insert(brokerConnections)
    .values({ userId: user.id, broker: "kite", ...values })
    .onConflictDoUpdate({ target: [brokerConnections.userId, brokerConnections.broker], set: values });
  redirect("/api/kite/login");
}
