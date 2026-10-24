import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { brokerConnections } from "@/db/schema";
import { requireUser } from "@/features/auth/session";
import { encryptToken } from "@/features/kite/crypto";
import { exchangeRequestToken, nextTokenExpiry } from "@/features/kite/client";

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
    const accessToken = await exchangeRequestToken(requestToken);
    const values = { accessTokenEnc: encryptToken(accessToken), tokenExpiresAt: nextTokenExpiry() };
    await db
      .insert(brokerConnections)
      .values({ userId: user.id, broker: "kite", ...values })
      .onConflictDoUpdate({ target: [brokerConnections.userId, brokerConnections.broker], set: values });
    return done("connected");
  } catch {
    return done("error");
  }
}
