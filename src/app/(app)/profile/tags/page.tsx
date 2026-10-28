import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { PageHeader, SectionCard } from "@/components/ui";
import { DEFAULT_PLATFORMS } from "@/domain/platform";
import { requireUser } from "@/features/auth/session";
import { loadPortfolio } from "@/features/portfolio/data";
import { PlatformManager, TagManager, type PlatformRow } from "@/features/profile/Managers";
import { userPlatforms } from "@/db/schema";
import { eq } from "drizzle-orm";

export const metadata = { title: "Platforms and tags" };

export default async function PlatformsAndTagsPage() {
  const user = await requireUser();
  const pf = await loadPortfolio(user.id);
  const custom = await db.select().from(userPlatforms).where(eq(userPlatforms.userId, user.id));
  const kindOf = new Map(custom.map((p) => [p.name, p.kind]));
  const uses = new Map<string, number>();
  for (const l of pf.lots) uses.set(l.platform ?? "Other", (uses.get(l.platform ?? "Other") ?? 0) + 1);

  const rows: PlatformRow[] = pf.platforms.map((name) => ({
    name,
    kind: kindOf.get(name) ?? "broker",
    builtIn: DEFAULT_PLATFORMS.includes(name),
    uses: uses.get(name) ?? 0,
  }));

  const tagRows = await db.execute<{ tag: string; uses: number }>(
    sql`select t as tag, count(*)::int as uses from assets, unnest(tags) as t where user_id = ${user.id} group by t order by t`,
  );

  return (
    <div>
      <PageHeader title="Platforms and tags" description="Where you hold things, and your own labels for grouping them." />
      <div className="space-y-5">
        <SectionCard title="Platforms" description="Brokers, banks and places like a locker. Pick one when you add a purchase." flush>
          <PlatformManager rows={rows} />
        </SectionCard>
        <SectionCard title="Tags" description="Personal groups such as Retirement or Kid's fund. Renaming merges tags that end up the same." flush>
          <TagManager tags={tagRows.rows.map((r) => ({ tag: r.tag, uses: Number(r.uses) }))} />
        </SectionCard>
      </div>
    </div>
  );
}
