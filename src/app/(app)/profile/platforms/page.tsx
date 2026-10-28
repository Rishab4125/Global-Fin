import { and, eq } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db/client";
import { brokerConnections } from "@/db/schema";
import { PageHeader, SectionCard } from "@/components/ui";
import { requireUser } from "@/features/auth/session";
import { KiteSettings } from "@/features/kite/KiteSettings";

export const metadata = { title: "Connected platforms" };

export default async function ConnectedPlatformsPage() {
  const user = await requireUser();
  const [conn] = await db
    .select()
    .from(brokerConnections)
    .where(and(eq(brokerConnections.userId, user.id), eq(brokerConnections.broker, "kite")))
    .limit(1);
  const lastSync = conn?.lastSyncAt
    ? conn.lastSyncAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })
    : null;

  return (
    <div>
      <PageHeader title="Connected platforms" description="Bring in holdings and trades you made elsewhere." />
      <div className="space-y-5">
        <SectionCard title="Zerodha Kite" description="Used by Sync on the Holdings page.">
          <KiteSettings connected={!!conn?.apiKey} lastSync={lastSync} />
          {conn?.apiKey && (
            <Link href="/holdings/sync" className="btn-ghost mt-3">
              Sync now
            </Link>
          )}
        </SectionCard>
        <SectionCard title="Groww and other reports" description="Upload a trade or P&L report. Nothing is placed or changed on the broker.">
          <Link href="/holdings/import" className="btn-ghost">
            Import trades
          </Link>
        </SectionCard>
      </div>
    </div>
  );
}
