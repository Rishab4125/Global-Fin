import { LineChart } from "lucide-react";
import { Amount } from "@/components/Amount";
import { EmptyState, SectionCard } from "@/components/ui";
import { todayIso } from "@/domain/dates";
import { ASSET_RULES } from "@/domain/taxRules";
import { requireUser } from "@/features/auth/session";
import { loadPortfolio } from "@/features/portfolio/data";
import { GainsTop } from "@/features/reports/GainsTop";
import { realisedView, type RealisedQuery } from "@/features/reports/realisedFilter";
import { totals } from "@/features/reports/summary";
import { formatDate, formatINR, formatINRWhole, formatQty, gainClass } from "@/lib/format";

export const metadata = { title: "Gains: Sales" };

export default async function GainsSalesPage({ searchParams }: { searchParams: Promise<RealisedQuery> }) {
  const query = await searchParams;
  const user = await requireUser();
  const pf = await loadPortfolio(user.id);
  const today = todayIso();

  const view = realisedView(pf, query, today);
  const rows = view.rows.filter((r) => r.kind === "sale").sort((a, b) => (a.date < b.date ? 1 : -1));
  const t = totals(rows);

  return (
    <div>
      <GainsTop
        pf={pf}
        view={view}
        today={today}
        active="sales"
        basePath="/gains/sales"
        description="Every sale with its gain, tax and what you keep. Tap a row on a phone for the rest."
      />

      <div className="mt-6">
        <SectionCard
          title="Sales"
          description={
            rows.length
              ? `${rows.length} sale${rows.length === 1 ? "" : "s"} · gain ${formatINRWhole(t.gain)} · post-tax ${formatINRWhole(t.net)}`
              : undefined
          }
          flush
        >
          {rows.length === 0 ? (
            <EmptyState
              icon={LineChart}
              title="No sales in this view"
              text="Record a sale from a holding, or change the period and filters."
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
                  <th className="th hidden text-right md:table-cell">Short term</th>
                  <th className="th hidden text-right md:table-cell">Long term</th>
                  <th className="th hidden text-right md:table-cell">Tax</th>
                  <th className="th text-right">Net</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="td sticky-col">{formatDate(r.date)}</td>
                    <td className="td">
                      <div className="font-medium">{r.label}</div>
                      <div className="t-caption max-w-56 truncate md:max-w-72" title={r.note || undefined}>
                        {ASSET_RULES[r.assetType].label}
                        {!r.taxApplied && " · no tax applied"}
                        {r.note && ` · ${r.note}`}
                      </div>
                      <details className="mt-1 md:hidden">
                        <summary className="t-caption cursor-pointer select-none text-primary">Details</summary>
                        <dl className="t-caption num mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5">
                          <dt>Quantity</dt>
                          <dd className="text-right">{r.qty === null ? "–" : formatQty(r.qty)}</dd>
                          <dt>Proceeds</dt>
                          <dd className="text-right"><Amount>{r.proceeds === null ? "–" : formatINR(r.proceeds)}</Amount></dd>
                          <dt>Cost</dt>
                          <dd className="text-right"><Amount>{r.cost === null ? "–" : formatINR(r.cost)}</Amount></dd>
                          <dt>Short term</dt>
                          <dd className="text-right"><Amount>{formatINR(r.stcg)}</Amount></dd>
                          <dt>Long term</dt>
                          <dd className="text-right"><Amount>{formatINR(r.ltcg)}</Amount></dd>
                          <dt>Tax</dt>
                          <dd className="text-right"><Amount>{formatINR(r.tax)}</Amount></dd>
                        </dl>
                      </details>
                    </td>
                    <td className="td num hidden text-right md:table-cell">{r.qty === null ? "–" : formatQty(r.qty)}</td>
                    <td className="td hidden text-right md:table-cell"><Amount>{r.proceeds === null ? "–" : formatINR(r.proceeds)}</Amount></td>
                    <td className="td hidden text-right md:table-cell"><Amount>{r.cost === null ? "–" : formatINR(r.cost)}</Amount></td>
                    <td className={`td hidden text-right md:table-cell ${gainClass(r.stcg)}`}><Amount>{formatINR(r.stcg)}</Amount></td>
                    <td className={`td hidden text-right md:table-cell ${gainClass(r.ltcg)}`}><Amount>{formatINR(r.ltcg)}</Amount></td>
                    <td className="td hidden text-right md:table-cell"><Amount>{formatINR(r.tax)}</Amount></td>
                    <td className={`td text-right font-semibold ${gainClass(r.netGain)}`}><Amount>{formatINR(r.netGain)}</Amount></td>
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
