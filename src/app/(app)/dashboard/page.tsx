import { BriefcaseBusiness, Coins, Landmark, PiggyBank, Plus, TrendingUp } from "lucide-react";
import Link from "next/link";
import { EmptyState, Kpi, PageHeader, SectionCard } from "@/components/ui";
import { ASSET_RULES } from "@/domain/taxRules";
import { requireUser } from "@/features/auth/session";
import { AllocationChart, GainByYearChart } from "@/features/dashboard/Charts";
import { loadPortfolio } from "@/features/portfolio/data";
import { byFinancialYear, totals } from "@/features/reports/summary";
import { formatINR } from "@/lib/format";

export default async function DashboardPage() {
  const user = await requireUser();
  const pf = await loadPortfolio(user.id);

  const invested = pf.holdings.reduce((s, h) => s + h.cost, 0);
  const t = totals(pf.rows);
  const years = byFinancialYear(pf.rows);

  const allocMap = new Map<string, number>();
  for (const h of pf.holdings) {
    const g = ASSET_RULES[h.type].group;
    allocMap.set(g, (allocMap.get(g) ?? 0) + h.cost);
  }
  const allocation = [...allocMap.entries()]
    .map(([group, cost]) => ({ group, cost: Math.round(cost) }))
    .sort((a, b) => b.cost - a.cost);

  const empty = pf.lots.length === 0 && pf.miscEvents.length === 0;
  const first = user.name ? user.name.split(" ")[0] : "";

  return (
    <div>
      <PageHeader
        title={first ? `Welcome back, ${first}` : "Dashboard"}
        description="Your portfolio and realised gains at a glance."
        actions={
          <Link href="/holdings" className="btn-primary">
            <Plus size={16} />
            Add investment
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Kpi label="Currently invested" value={formatINR(invested)} icon={BriefcaseBusiness} hint={`${pf.holdings.length} holdings`} />
        <Kpi label="Realised gain" value={formatINR(t.gain)} icon={TrendingUp} tone={t.gain >= 0 ? "gain" : "loss"} hint="Before tax" />
        <Kpi label="Estimated tax" value={formatINR(t.tax)} icon={Landmark} hint="Incl. 4% cess" />
        <Kpi label="Post-tax gain" value={formatINR(t.net)} icon={PiggyBank} tone={t.net >= 0 ? "gain" : "loss"} hint="What you keep" />
      </div>

      {empty ? (
        <div className="mt-6">
          <SectionCard>
            <EmptyState
              icon={Coins}
              title="No investments yet"
              text="Add your first investment to start tracking holdings and realised gains."
              action={
                <Link href="/holdings" className="btn-primary">
                  Add investment
                </Link>
              }
            />
          </SectionCard>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <SectionCard title="Post-tax gain by financial year" description="Green is profit, red is loss">
            {years.length ? (
              <GainByYearChart data={years} />
            ) : (
              <p className="py-10 text-center text-sm text-muted">No realised gains yet.</p>
            )}
          </SectionCard>
          <SectionCard title="Invested by asset class" description="Cost of what you currently hold">
            {allocation.length ? (
              <AllocationChart data={allocation} />
            ) : (
              <p className="py-10 text-center text-sm text-muted">No holdings yet.</p>
            )}
          </SectionCard>
        </div>
      )}
    </div>
  );
}
