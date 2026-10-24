import { createHash } from "node:crypto";
import type { KiteHolding } from "@/domain/brokerSync";

const API = "https://api.kite.trade";

export interface KiteCreds {
  apiKey: string;
  apiSecret: string;
}

/** Credentials and tokens are encrypted with this key, so it must be set on the server. */
export const kiteConfigured = () => !!process.env.KITE_TOKEN_ENC_KEY;

export function kiteLoginUrl(apiKey: string, state: string): string {
  const params = new URLSearchParams({ v: "3", api_key: apiKey, redirect_params: `state=${state}` });
  return `https://kite.zerodha.com/connect/login?${params}`;
}

export async function exchangeRequestToken({ apiKey, apiSecret }: KiteCreds, requestToken: string): Promise<string> {
  const checksum = createHash("sha256").update(apiKey + requestToken + apiSecret).digest("hex");
  const res = await fetch(`${API}/session/token`, {
    method: "POST",
    headers: { "X-Kite-Version": "3", "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ api_key: apiKey, request_token: requestToken, checksum }),
  });
  const json = (await res.json()) as { data?: { access_token?: string } };
  const token = json.data?.access_token;
  if (!res.ok || !token) throw new Error("Kite token exchange failed");
  return token;
}

/** Kite access tokens expire at about 6:00 AM IST (00:30 UTC) the next day. */
export function nextTokenExpiry(now = new Date()): Date {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 30));
  if (d <= now) d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

export class KiteAuthError extends Error {}

interface RawHolding {
  tradingsymbol: string;
  isin?: string;
  quantity: number;
  t1_quantity?: number;
  collateral_quantity?: number;
  average_price: number;
  last_price: number;
}

export async function fetchHoldings({ apiKey }: KiteCreds, accessToken: string): Promise<KiteHolding[]> {
  const res = await fetch(`${API}/portfolio/holdings`, {
    headers: { "X-Kite-Version": "3", Authorization: `token ${apiKey}:${accessToken}` },
    cache: "no-store",
  });
  if (res.status === 403) throw new KiteAuthError("Kite session expired");
  const json = (await res.json()) as { data?: RawHolding[] };
  if (!res.ok || !json.data) throw new Error("Could not fetch holdings from Kite");

  return json.data
    .map((h) => ({
      isin: h.isin ?? "",
      symbol: h.tradingsymbol,
      qty: h.quantity + (h.t1_quantity ?? 0) + (h.collateral_quantity ?? 0),
      avgPrice: h.average_price,
      lastPrice: h.last_price || h.average_price,
    }))
    .filter((h) => h.isin && h.qty > 0);
}
