import { LineChart } from "lucide-react";
import { Amount } from "@/components/Amount";
import { EmptyState, SectionCard } from "@/components/ui";
import { todayIso } from "@/domain/dates";
import { requireUser } from "@/features/auth/session";
import { GainByYearChart } from "@/features/dashboard/Charts";
import { loadPortfolio } from "@/features/portfolio/data";
import { GainsTop } from "@/features/reports/GainsTop";
import { realisedView, type RealisedQuery } from "@/features/reports/realisedFilter";
import { byAssetGroup, byFinancialYear, termSplit } from "@/features/reports/summary";
import { formatINRWhole, gainClass } from "@/lib/format";

export const metadata = { title: "Gains" };

export default async function GainsSummaryPage({ searchParams }: { searchParams: Promise<RealisedQuery> }) {
  const query = await searchParams;
  const user = await requireUser();
  const pf = await loadPortfolio(user.id);
  const today = todayIso();

  const view = realisedView(pf, query, today);
  const categories = byAssetGroup(view.rows).sort((a, b) => Math.abs(b.gain) - Math.abs(a.gain));
  const years = byFinancialYear(view.rows);
  const split = termSplit(view.rows);
  const splitRows = [
    { label: "Short term", note: "Held up to the long-term limit", value: split.short },
    { label: "Long term", note: "Held beyond the long-term limit", value: split.long },
    { label: "Dividends and other income", note: "Taxed at your slab rate", value: split.income },
    { label: "Other", note: "Share buyback adjustments", value: split.other },
  ].filter((r) => r.value !== 0 || r.label !== "Other");

  return (
    <div>
      <GainsTop
        pf={pf}
        view={view}
        today={today}
        active="summary"
        basePath="/gains"
        description="Profit and loss from sales and other income, with estimated tax. Losses reduce gains in the same financial year."
      />

      {view.rows.length === 0 ? (
        <div className="mt-6">
          <SectionCard flush>
            <EmptyState
              icon={LineChart}
              title="No realised gains yet"
              text="Record a sale or a misc entry, or change the period and filters."
            />
          </SectionCard>
        </div>
      ) : (
        <div className="mt-6 space-y-5">
          <SectionCard title="By category" description="Gain, tax and what is left after tax.">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {categories.map((g) => (
                <div key={g.group} className="rounded-lg border border-line p-4">
                  <div className="t-label">{g.group}</div>
                  <div className={`t-value num mt-1 ${gainClass(g.gain)}`}>
                    <Amount>{formatINRWhole(g.gain)}</Amount>
                  </div>
                  <div className="t-caption num mt-0.5">
                    Tax <Amount>{formatINRWhole(g.tax)}</Amount> · Post-tax <Amount>{formatINRWhole(g.net)}</Amount>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          <div className="grid gap-5 lg:grid-cols-2">
            <SectionCard title="Short term and long term" description="Where the gain came from. Dividends are income, not capital gain.">
              <ul className="divide-y divide-line">
                {splitRows.map((r) => (
                  <li key={r.label} className="flex items-baseline justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <div className="t-body-strong">{r.label}</div>
                      <div className="t-caption">{r.note}</div>
                    </div>
                    <div className={`t-value num shrink-0 ${gainClass(r.value)}`}>
                      <Amount>{formatINRWhole(r.value)}</Amount>
                    </div>
                  </li>
                ))}
                <li className="flex items-baseline justify-between gap-3 py-3">
                  <div className="t-body-strong">Gross gain</div>
                  <div className={`t-value num shrink-0 ${gainClass(split.total)}`}>
                    <Amount>{formatINRWhole(split.total)}</Amount>
                  </div>
                </li>
              </ul>
            </SectionCard>

            <SectionCard title="Post-tax gain by financial year" description="Green is profit, red is loss. Estimated tax included.">
              <GainByYearChart data={years} />
            </SectionCard>
          </div>
        </div>
      )}
    </div>
  );
}
