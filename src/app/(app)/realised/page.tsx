import { Download, LineChart } from "lucide-react";
import Link from "next/link";
import { EmptyState, Kpi, PageHeader, SectionCard } from "@/components/ui";
import { ASSET_RULES } from "@/domain/taxRules";
import { requireUser } from "@/features/auth/session";
import { loadPortfolio } from "@/features/portfolio/data";
import { byAssetGroup, totals } from "@/features/reports/summary";
import { formatDate, formatINR, formatQty, gainClass } from "@/lib/format";

export const metadata = { title: "Realised gains" };

export default async function RealisedPage({
  searchParams,
}: {
  searchParams: Promise<{ fy?: string }>;
}) {
  const { fy = "all" } = await searchParams;
  const user = await requireUser();
  const pf = await loadPortfolio(user.id);

  const years = [...new Set(pf.rows.map((r) => r.fy))].sort().reverse();
  const rows = pf.rows
    .filter((r) => fy === "all" || r.fy === fy)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  const t = totals(rows);
  const groups = byAssetGroup(rows);

  return (
    <div>
      <PageHeader
        title="Realised gains"
        description="Profit and loss from sales and misc entries, with estimated tax. Losses reduce gains in the same financial year."
        actions={
          <a
            href={`/realised/export?fy=${fy}`}
            aria-label="Export CSV"
            title="Export CSV"
            className="btn-ghost shrink-0 max-sm:!w-10 max-sm:!min-w-10 max-sm:!px-0"
          >
            <Download size={16} />
            <span className="hidden sm:inline">Export CSV</span>
          </a>
        }
      />

      <div className="mb-5 flex gap-1.5 overflow-x-auto pb-1">
        {["all", ...years].map((y) => (
          <Link
            key={y}
            href={`/realised?fy=${y}`}
            className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
              y === fy
                ? "bg-primary text-(--on-primary)"
                : "border border-line bg-surface text-muted hover:text-ink"
            }`}
          >
            {y === "all" ? "All years" : `FY ${y}`}
          </Link>
        ))}
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
              text="Sell a holding or add a misc profit/loss entry to see it here."
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
