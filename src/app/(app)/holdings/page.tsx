import { BriefcaseBusiness } from "lucide-react";
import Link from "next/link";
import { EmptyState, PageHeader, SectionCard } from "@/components/ui";
import { todayIso } from "@/domain/dates";
import { ASSET_RULES } from "@/domain/taxRules";
import { requireUser } from "@/features/auth/session";
import { AddBuyForm } from "@/features/holdings/AddBuyForm";
import { loadPortfolio } from "@/features/portfolio/data";
import { formatINR, formatQty } from "@/lib/format";

export default async function HoldingsPage() {
  const user = await requireUser();
  const pf = await loadPortfolio(user.id);
  const totalCost = pf.holdings.reduce((s, h) => s + h.cost, 0);
  const heldIds = new Set(pf.holdings.map((h) => h.id));
  const closed = pf.assets.filter((a) => !heldIds.has(a.id) && pf.lots.some((l) => l.assetId === a.id));

  return (
    <div>
      <PageHeader
        title="Holdings"
        description={
          pf.holdings.length ? `${pf.holdings.length} holdings · ${formatINR(totalCost)} invested` : "Record what you own."
        }
      />
      <div className="space-y-5">
        <AddBuyForm today={todayIso()} />
        <SectionCard title="Current holdings" flush>
          {pf.holdings.length === 0 ? (
            <EmptyState
              icon={BriefcaseBusiness}
              title="No holdings yet"
              text="Add your first investment using the form above."
            />
          ) : (
            <table className="w-full">
              <thead>
                <tr>
                  <th className="th">Name</th>
                  <th className="th">Type</th>
                  <th className="th text-right">Quantity</th>
                  <th className="th text-right">Avg cost</th>
                  <th className="th text-right">Invested</th>
                  <th className="th" />
                </tr>
              </thead>
              <tbody>
                {pf.holdings.map((h) => (
                  <tr key={h.id}>
                    <td className="td font-medium">
                      <Link href={`/holdings/${h.id}`} className="hover:text-primary hover:underline">
                        {h.name}
                      </Link>
                    </td>
                    <td className="td text-muted">{ASSET_RULES[h.type].label}</td>
                    <td className="td text-right">{formatQty(h.qty)}</td>
                    <td className="td text-right">{formatINR(h.avgCost)}</td>
                    <td className="td text-right font-medium">{formatINR(h.cost)}</td>
                    <td className="td text-right">
                      <div className="flex justify-end gap-2">
                        <Link href={`/holdings/${h.id}`} className="btn-ghost !h-8 !px-3">
                          Details
                        </Link>
                        <Link href={`/sell/${h.id}`} className="btn-accent !h-8 !px-3">
                          Sell
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </SectionCard>

        {closed.length > 0 && (
          <SectionCard title="Fully sold" description="Past holdings you no longer own" flush>
            <ul className="divide-y divide-line">
              {closed.map((a) => (
                <li key={a.id}>
                  <Link href={`/holdings/${a.id}`} className="flex items-center justify-between px-5 py-3 hover:bg-surface2">
                    <span className="font-medium">{a.name}</span>
                    <span className="text-sm text-muted">{ASSET_RULES[a.type].label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </SectionCard>
        )}
      </div>
    </div>
  );
}
