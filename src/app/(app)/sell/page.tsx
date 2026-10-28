import { BriefcaseBusiness } from "lucide-react";
import Link from "next/link";
import { EmptyState, PageHeader, SectionCard } from "@/components/ui";
import { ASSET_RULES } from "@/domain/taxRules";
import { requireUser } from "@/features/auth/session";
import { loadPortfolio } from "@/features/portfolio/data";
import { formatINRWhole, formatQty } from "@/lib/format";

export const metadata = { title: "Add sale" };

/** Pick which holding a sale belongs to. The sale form itself lives at /sell/<holding>. */
export default async function PickHoldingPage() {
  const user = await requireUser();
  const pf = await loadPortfolio(user.id);
  const holdings = [...pf.holdings].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div>
      <PageHeader title="Add sale" description="Choose the holding you sold. This records a sale that already happened; nothing is placed." />
      <SectionCard flush>
        {holdings.length === 0 ? (
          <EmptyState
            icon={BriefcaseBusiness}
            title="Nothing to sell yet"
            text="Add an investment first, then record a sale against it."
            action={
              <Link href="/holdings?add=1" className="btn-primary">
                Add investment
              </Link>
            }
          />
        ) : (
          <ul className="divide-y divide-line">
            {holdings.map((h) => (
              <li key={h.id}>
                <Link href={`/sell/${h.id}`} className="flex items-center justify-between gap-3 px-5 py-3 outline-none hover:bg-surface2 focus-visible:bg-surface2">
                  <span className="min-w-0">
                    <span className="t-body-strong block truncate">{h.name}</span>
                    <span className="t-caption block">{ASSET_RULES[h.type].category}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="t-body-strong num block">{formatQty(h.qty, h.type)} held</span>
                    <span className="t-caption num block">{formatINRWhole(h.cost)} invested</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
