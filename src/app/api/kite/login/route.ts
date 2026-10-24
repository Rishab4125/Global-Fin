import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { requireUser } from "@/features/auth/session";
import { kiteConfigured, kiteLoginUrl } from "@/features/kite/client";

export async function GET(request: Request) {
  await requireUser();
  if (!kiteConfigured()) return NextResponse.redirect(new URL("/holdings/sync?kite=unconfigured", request.url));

  const state = randomBytes(16).toString("hex");
  const res = NextResponse.redirect(kiteLoginUrl(state));
  res.cookies.set("kite_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/api/kite",
  });
  return res;
}
