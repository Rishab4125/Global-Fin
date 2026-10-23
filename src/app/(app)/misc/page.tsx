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
    <div className="space-y-6">
      <MiscForm today={todayIso()} />
      <section className="card overflow-x-auto p-0">
        <h2 className="px-5 pt-5 text-lg font-semibold text-primary-strong">Misc entries</h2>
        {entries.length === 0 ? (
          <p className="px-5 py-8 text-sm text-muted">No miscellaneous entries yet.</p>
        ) : (
          <table className="mt-3 w-full">
            <thead className="border-b border-line">
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
            <tbody className="divide-y divide-line">
              {entries.map((e) => {
                const r = rowById.get(e.id);
                return (
                  <tr key={e.id}>
                    <td className="td">{formatDate(e.date)}</td>
                    <td className="td">{ASSET_RULES[e.assetType].label}</td>
                    <td className={`td text-right font-medium ${gainClass(e.amount)}`}>{formatINR(e.amount)}</td>
                    <td className="td">{e.taxAdjusted ? "Yes" : "No"}</td>
                    <td className="td text-right">{formatINR(r?.tax ?? 0)}</td>
                    <td className={`td text-right ${gainClass(r?.netGain ?? 0)}`}>{formatINR(r?.netGain ?? 0)}</td>
                    <td className="td text-muted">{e.note}</td>
                    <td className="td text-right">
                      <form action={deleteMiscAction}>
                        <input type="hidden" name="id" value={e.id} />
                        <button className="text-sm text-loss hover:underline">Delete</button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
