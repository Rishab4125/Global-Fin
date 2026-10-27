import { BriefcaseBusiness, Coins, Landmark, PiggyBank, Plus, RefreshCw, TrendingUp } from "lucide-react";
import Link from "next/link";
import { EmptyState, Kpi, PageHeader, SectionCard } from "@/components/ui";
import { todayIso } from "@/domain/dates";
import { fyOptions, inPeriod, resolvePeriod } from "@/domain/period";
import { ASSET_RULES } from "@/domain/taxRules";
import { requireUser } from "@/features/auth/session";
import { AllocationChart, GainByYearChart } from "@/features/dashboard/Charts";
import { PeriodFilter } from "@/features/dashboard/PeriodFilter";
import { loadPortfolio } from "@/features/portfolio/data";
import { byFinancialYear, totals } from "@/features/reports/summary";
import { formatDate, formatINR } from "@/lib/format";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string }>;
}) {
  const query = await searchParams;
  const user = await requireUser();
  const pf = await loadPortfolio(user.id);
  const today = todayIso();

  const allDates = [
    ...pf.lots.map((l) => l.buyDate),
    ...pf.saleEvents.map((s) => s.date),
    ...pf.miscEvents.map((m) => m.date),
  ].sort();
  const period = resolvePeriod(query, today);
  const options = fyOptions(allDates[0] ?? null, today).map((fy, i) => ({
    value: `fy:${fy}`,
    label: i === 0 ? `FY ${fy} (current)` : `FY ${fy}`,
  }));
  if (period.value.startsWith("fy:") && !options.some((o) => o.value === period.value)) {
    options.push({ value: period.value, label: period.label });
  }

  const periodRows = pf.rows.filter((r) => inPeriod(r.date, period));
  const invested = pf.holdings.reduce((s, h) => s + h.cost, 0);
  const t = totals(periodRows);
  const years = byFinancialYear(pf.rows);

  const periodText =
    period.value === "custom" && period.from && period.to
      ? `${formatDate(period.from)} to ${formatDate(period.to)}`
      : period.label;

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
          <div className="flex gap-2">
            <Link
              href="/holdings/sync"
              aria-label="Sync"
              title="Sync holdings from Zerodha"
              className="btn-ghost shrink-0 max-sm:!w-10 max-sm:!min-w-10 max-sm:!px-0"
            >
              <RefreshCw size={16} />
              <span className="hidden sm:inline">Sync</span>
            </Link>
            <Link
              href="/holdings"
              aria-label="Add investment"
              title="Add investment"
              className="btn-primary shrink-0 max-sm:!w-10 max-sm:!min-w-10 max-sm:!px-0"
            >
              <Plus size={16} />
              <span className="hidden sm:inline">Add investment</span>
            </Link>
          </div>
        }
      />

      <div className="mb-4">
        <PeriodFilter
          options={options}
          value={period.value}
          from={period.from ?? ""}
          to={period.to ?? ""}
          earliest={allDates[0] ?? today}
          today={today}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Kpi
          label="Currently invested"
          value={formatINR(invested)}
          icon={BriefcaseBusiness}
          hint={`${pf.holdings.length} holdings, as of today`}
        />
        <Kpi
          label="Realised gain"
          value={formatINR(t.gain)}
          icon={TrendingUp}
          tone={t.gain >= 0 ? "gain" : "loss"}
          hint={`Before tax · ${periodText}`}
        />
        <Kpi label="Estimated tax" value={formatINR(t.tax)} icon={Landmark} hint={`Incl. 4% cess · ${periodText}`} />
        <Kpi
          label="Post-tax gain"
          value={formatINR(t.net)}
          icon={PiggyBank}
          tone={t.net >= 0 ? "gain" : "loss"}
          hint={`What you keep · ${periodText}`}
        />
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
