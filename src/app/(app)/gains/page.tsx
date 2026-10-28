import { Download, LineChart } from "lucide-react";
import { FilterBar } from "@/components/FilterBar";
import { GainsTabs } from "@/components/SegmentLinks";
import { EmptyState, Kpi, PageHeader, SectionCard } from "@/components/ui";
import { todayIso } from "@/domain/dates";
import { fyOptions } from "@/domain/period";
import { ASSET_RULES } from "@/domain/taxRules";
import { requireUser } from "@/features/auth/session";
import { PeriodFilter } from "@/features/dashboard/PeriodFilter";
import { loadPortfolio } from "@/features/portfolio/data";
import { realisedView, RESULTS, TERMS, type RealisedQuery } from "@/features/reports/realisedFilter";
import { byAssetGroup, totals } from "@/features/reports/summary";
import { formatDate, formatINR, formatQty, gainClass } from "@/lib/format";

export const metadata = { title: "Gains" };

export default async function RealisedPage({ searchParams }: { searchParams: Promise<RealisedQuery> }) {
  const query = await searchParams;
  const user = await requireUser();
  const pf = await loadPortfolio(user.id);
  const today = todayIso();

  const view = realisedView(pf, query, today);
  const { period, filters, groups: groupOptions } = view;
  const rows = [...view.rows].sort((a, b) => (a.date < b.date ? 1 : -1));
  const t = totals(rows);
  const groups = byAssetGroup(rows);

  const earliest = pf.rows.map((r) => r.date).sort()[0] ?? today;
  const options = fyOptions(pf.rows.length ? earliest : null, today).map((fy, i) => ({
    value: `fy:${fy}`,
    label: i === 0 ? `FY ${fy} (current)` : `FY ${fy}`,
  }));
  if (period.value.startsWith("fy:") && !options.some((o) => o.value === period.value)) {
    options.push({ value: period.value, label: period.label });
  }
  const exportQs = [view.periodQuery, view.fq].filter(Boolean).join("&");

  return (
    <div>
      <PageHeader
        title="Gains"
        description="Profit and loss from sales, with estimated tax. Losses reduce gains in the same financial year."
        actions={
          <a
            href={`/gains/export?${exportQs}`}
            aria-label="Export CSV"
            title="Export CSV"
            className="btn-ghost shrink-0 max-sm:!w-10 max-sm:!min-w-10 max-sm:!px-0"
          >
            <Download size={16} />
            <span className="hidden sm:inline">Export CSV</span>
          </a>
        }
      />

      <GainsTabs active="sales" />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <PeriodFilter
          options={options}
          value={period.value}
          from={period.from ?? ""}
          to={period.to ?? ""}
          earliest={earliest}
          today={today}
          basePath="/gains"
          extraQuery={view.fq}
        />
        <FilterBar
          basePath="/gains"
          selected={filters}
          groups={[
            { id: "ty", label: "Category", options: groupOptions.length > 1 ? groupOptions : [] },
            { id: "term", label: "Term", options: TERMS },
            { id: "sign", label: "Result", options: RESULTS },
            { id: "pf", label: "Platform", options: pf.platforms },
          ]}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        <Kpi label="Gross gain" value={formatINR(t.gain)} tone={t.gain >= 0 ? "gain" : "loss"} />
        <Kpi label="Estimated tax" value={formatINR(t.tax)} hint="Incl. 4% cess" />
        <Kpi label="Post-tax gain" value={formatINR(t.net)} tone={t.net >= 0 ? "gain" : "loss"} />
      </div>

      <div className="mt-6 space-y-5">
        {groups.length > 0 && (
          <SectionCard title="By asset class">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {groups.map((g) => (
                <div key={g.group} className="rounded-lg border border-line p-4">
                  <div className="kpi-label">{g.group}</div>
                  <div className={`num mt-1 text-lg font-semibold ${gainClass(g.gain)}`}>{formatINR(g.gain)}</div>
                  <div className="num mt-0.5 text-xs text-muted">
                    Tax {formatINR(g.tax)} · Net {formatINR(g.net)}
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        <SectionCard title="Details" flush>
          {rows.length === 0 ? (
            <EmptyState
              icon={LineChart}
              title="No realised gains yet"
              text="Sell a holding or add a misc profit/loss entry, or change the period and filters."
            />
          ) : (
            <table className="w-full">
              <thead>
                <tr>
                  <th className="th sticky-col">Date</th>
                  <th className="th">Asset</th>
                  <th className="th hidden text-right md:table-cell">Qty</th>
                  <th className="th hidden text-right md:table-cell">Proceeds</th>
                  <th className="th hidden text-right md:table-cell">Cost</th>
                  <th className="th text-right">Short term</th>
                  <th className="th text-right">Long term</th>
                  <th className="th text-right">Tax</th>
                  <th className="th text-right">Net</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="td sticky-col">{formatDate(r.date)}</td>
                    <td className="td">
                      <div className="font-medium">{r.label}</div>
                      <div
                        className="max-w-56 truncate text-xs text-muted"
                        title={r.note || undefined}
                      >
                        {ASSET_RULES[r.assetType].label}
                        {!r.taxApplied && " · no tax applied"}
                        {r.note && ` · ${r.note}`}
                      </div>
                    </td>
                    <td className="td hidden text-right md:table-cell">{r.qty === null ? "–" : formatQty(r.qty)}</td>
                    <td className="td hidden text-right md:table-cell">{r.proceeds === null ? "–" : formatINR(r.proceeds)}</td>
                    <td className="td hidden text-right md:table-cell">{r.cost === null ? "–" : formatINR(r.cost)}</td>
                    <td className={`td text-right ${gainClass(r.stcg)}`}>{formatINR(r.stcg)}</td>
                    <td className={`td text-right ${gainClass(r.ltcg)}`}>{formatINR(r.ltcg)}</td>
                    <td className="td text-right">{formatINR(r.tax)}</td>
                    <td className={`td text-right font-semibold ${gainClass(r.netGain)}`}>{formatINR(r.netGain)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
