import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { brokerConnections } from "@/db/schema";
import { decryptToken } from "./crypto";
import type { KiteCreds } from "./client";

export async function loadConnection(userId: string) {
  const [conn] = await db
    .select()
    .from(brokerConnections)
    .where(and(eq(brokerConnections.userId, userId), eq(brokerConnections.broker, "kite")))
    .limit(1);
  return conn ?? null;
}

type Conn = NonNullable<Awaited<ReturnType<typeof loadConnection>>>;

export function credsOf(conn: Conn): KiteCreds | null {
  if (!conn.apiKey || !conn.apiSecretEnc) return null;
  return { apiKey: conn.apiKey, apiSecret: decryptToken(conn.apiSecretEnc) };
}

export const tokenValid = (conn: Conn | null) =>
  !!conn?.accessTokenEnc && !!conn.tokenExpiresAt && conn.tokenExpiresAt > new Date();
