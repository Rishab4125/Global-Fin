import { Receipt } from "lucide-react";
import { EmptyState, PageHeader, SectionCard } from "@/components/ui";
import { todayIso } from "@/domain/dates";
import { ASSET_RULES } from "@/domain/taxRules";
import { requireUser } from "@/features/auth/session";
import { MiscForm } from "@/features/misc/MiscForm";
import { deleteMiscAction } from "@/features/misc/actions";
import { loadPortfolio } from "@/features/portfolio/data";
import { formatDate, formatINR, gainClass } from "@/lib/format";

export default async function MiscPage() {
  const user = await requireUser();
  const pf = await loadPortfolio(user.id);
  const rowById = new Map(pf.rows.map((r) => [r.id, r]));
  const entries = [...pf.miscEvents].sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <div>
      <PageHeader
        title="Misc profit / loss"
        description="Record a one-off gain or loss without a buy and sell, such as dividends or F&O."
      />
      <div className="space-y-5">
        <MiscForm today={todayIso()} />
        <SectionCard title="Entries" flush>
          {entries.length === 0 ? (
            <EmptyState icon={Receipt} title="No entries yet" text="Entries you add above appear here." />
          ) : (
            <table className="w-full">
              <thead>
                <tr>
                  <th className="th">Date</th>
                  <th className="th">Type</th>
                  <th className="th text-right">Amount</th>
                  <th className="th">Tax adjusted</th>
                  <th className="th text-right">Tax</th>
                  <th className="th text-right">Net</th>
                  <th className="th">Note</th>
                  <th className="th" />
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => {
                  const r = rowById.get(e.id);
                  return (
                    <tr key={e.id}>
                      <td className="td">{formatDate(e.date)}</td>
                      <td className="td">{ASSET_RULES[e.assetType].label}</td>
                      <td className={`td text-right font-medium ${gainClass(e.amount)}`}>{formatINR(e.amount)}</td>
                      <td className="td">
                        <span className={`badge ${e.taxAdjusted ? "bg-primary-soft text-primary-strong" : "bg-surface2 text-muted"}`}>
                          {e.taxAdjusted ? "Yes" : "No"}
                        </span>
                      </td>
                      <td className="td text-right">{formatINR(r?.tax ?? 0)}</td>
                      <td className={`td text-right ${gainClass(r?.netGain ?? 0)}`}>{formatINR(r?.netGain ?? 0)}</td>
                      <td className="td text-muted">{e.note}</td>
                      <td className="td text-right">
                        <form action={deleteMiscAction}>
                          <input type="hidden" name="id" value={e.id} />
                          <button className="text-sm font-medium text-loss hover:underline">Delete</button>
                        </form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
