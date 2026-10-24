import { ArrowLeft } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/features/auth/session";
import { kiteConfigured } from "@/features/kite/client";
import { loadConnection, tokenValid } from "@/features/kite/connection";
import { KiteCard } from "@/features/kite/KiteCard";
import { KiteSetup } from "@/features/kite/KiteSetup";

export default async function SyncPage({ searchParams }: { searchParams: Promise<{ kite?: string }> }) {
  const user = await requireUser();
  const { kite } = await searchParams;
  const conn = await loadConnection(user.id);

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");

  const hasCredentials = !!conn?.apiKey && !!conn.apiSecretEnc;
  const lastSync = conn?.lastSyncAt
    ? conn.lastSyncAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })
    : null;

  return (
    <div>
      <Link href="/holdings" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft size={16} />
        Holdings
      </Link>
      <PageHeader title="Sync holdings" description="Update your holdings from your Zerodha account." />
      {hasCredentials ? (
        <KiteCard
          hasConnection={!!conn?.accessTokenEnc}
          connected={tokenValid(conn)}
          lastSync={lastSync}
          flash={kite ?? null}
        />
      ) : (
        <KiteSetup callbackUrl={`${proto}://${host}/api/kite/callback`} configured={kiteConfigured()} />
      )}
    </div>
  );
}
