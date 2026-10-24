import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { requireUser } from "@/features/auth/session";
import { kiteLoginUrl } from "@/features/kite/client";
import { credsOf, loadConnection } from "@/features/kite/connection";

export async function GET(request: Request) {
  const user = await requireUser();
  const conn = await loadConnection(user.id);
  const creds = conn && credsOf(conn);
  if (!creds) return NextResponse.redirect(new URL("/holdings/sync", request.url));

  const state = randomBytes(16).toString("hex");
  const res = NextResponse.redirect(kiteLoginUrl(creds.apiKey, state));
  res.cookies.set("kite_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/api/kite",
  });
  return res;
}
