import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { brokerConnections } from "@/db/schema";
import { requireUser } from "@/features/auth/session";
import { exchangeRequestToken, nextTokenExpiry } from "@/features/kite/client";
import { credsOf, loadConnection } from "@/features/kite/connection";
import { encryptToken } from "@/features/kite/crypto";

export async function GET(request: Request) {
  const user = await requireUser();
  const url = new URL(request.url);
  const done = (result: string) => {
    const res = NextResponse.redirect(new URL(`/holdings/sync?kite=${result}`, request.url));
    res.cookies.delete({ name: "kite_state", path: "/api/kite" });
    return res;
  };

  const cookieState = request.headers
    .get("cookie")
    ?.split(/;\s*/)
    .find((c) => c.startsWith("kite_state="))
    ?.slice("kite_state=".length);
  const requestToken = url.searchParams.get("request_token");
  if (
    url.searchParams.get("status") !== "success" ||
    !requestToken ||
    !cookieState ||
    cookieState !== url.searchParams.get("state")
  ) {
    return done("error");
  }

  try {
    const conn = await loadConnection(user.id);
    const creds = conn && credsOf(conn);
    if (!creds) return done("error");
    const accessToken = await exchangeRequestToken(creds, requestToken);
    await db
      .update(brokerConnections)
      .set({ accessTokenEnc: encryptToken(accessToken), tokenExpiresAt: nextTokenExpiry() })
      .where(and(eq(brokerConnections.userId, user.id), eq(brokerConnections.broker, "kite")));
    return done("connected");
  } catch {
    return done("error");
  }
}
