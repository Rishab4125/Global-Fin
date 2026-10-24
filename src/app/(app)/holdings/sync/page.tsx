import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { brokerConnections } from "@/db/schema";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/features/auth/session";
import { kiteConfigured } from "@/features/kite/client";
import { KiteCard } from "@/features/kite/KiteCard";

export default async function SyncPage({ searchParams }: { searchParams: Promise<{ kite?: string }> }) {
  const user = await requireUser();
  const { kite } = await searchParams;
  const [conn] = await db
    .select()
    .from(brokerConnections)
    .where(and(eq(brokerConnections.userId, user.id), eq(brokerConnections.broker, "kite")))
    .limit(1);

  const hasConnection = !!conn;
  const connected = !!conn && conn.tokenExpiresAt > new Date();
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
      <KiteCard
        configured={kiteConfigured()}
        hasConnection={hasConnection}
        connected={connected}
        lastSync={lastSync}
        flash={kite ?? null}
      />
    </div>
  );
}
