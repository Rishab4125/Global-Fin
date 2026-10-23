import Link from "next/link";
import { ASSET_RULES } from "@/domain/taxRules";
import { requireUser } from "@/features/auth/session";
import { AllocationChart, GainByYearChart } from "@/features/dashboard/Charts";
import { loadPortfolio } from "@/features/portfolio/data";
import { byFinancialYear, totals } from "@/features/reports/summary";
import { formatINR, gainClass } from "@/lib/format";

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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-primary-strong">Hello{user.name ? `, ${user.name.split(" ")[0]}` : ""}</h1>

      {empty && (
        <div className="card flex flex-wrap items-center justify-between gap-3 border-accent/50 bg-accent/10">
          <p className="text-sm">Start by adding your first investment.</p>
          <Link href="/holdings" className="btn-accent">
            Add investment
          </Link>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Currently invested" value={formatINR(invested)} />
        <Kpi label="Realised gain" value={formatINR(t.gain)} cls={gainClass(t.gain)} />
        <Kpi label="Estimated tax" value={formatINR(t.tax)} />
        <Kpi label="Post-tax gain" value={formatINR(t.net)} cls={gainClass(t.net)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card">
          <h2 className="mb-2 text-lg font-semibold text-primary-strong">Post-tax gain by financial year</h2>
          {years.length ? (
            <GainByYearChart data={years} />
          ) : (
            <p className="py-10 text-center text-sm text-muted">No realised gains yet.</p>
          )}
        </section>
        <section className="card">
          <h2 className="mb-2 text-lg font-semibold text-primary-strong">Invested by asset class</h2>
          {allocation.length ? (
            <AllocationChart data={allocation} />
          ) : (
            <p className="py-10 text-center text-sm text-muted">No holdings yet.</p>
          )}
        </section>
      </div>
    </div>
  );
}

function Kpi({ label, value, cls = "" }: { label: string; value: string; cls?: string }) {
  return (
    <div className="card">
      <div className="label">{label}</div>
      <div className={`text-2xl font-bold ${cls}`}>{value}</div>
    </div>
  );
}
