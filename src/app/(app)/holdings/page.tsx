import Link from "next/link";
import { requireUser } from "@/features/auth/session";
import { AddBuyForm } from "@/features/holdings/AddBuyForm";
import { loadPortfolio } from "@/features/portfolio/data";
import { ASSET_RULES } from "@/domain/taxRules";
import { todayIso } from "@/domain/dates";
import { formatINR, formatQty } from "@/lib/format";

export default async function HoldingsPage() {
  const user = await requireUser();
  const pf = await loadPortfolio(user.id);
  const totalCost = pf.holdings.reduce((s, h) => s + h.cost, 0);

  return (
    <div className="space-y-6">
      <AddBuyForm today={todayIso()} />

      <section className="card overflow-x-auto p-0">
        <div className="flex items-center justify-between px-5 pt-5">
          <h2 className="text-lg font-semibold text-primary-strong">Current holdings</h2>
          <span className="text-sm text-muted">Invested: {formatINR(totalCost)}</span>
        </div>
        {pf.holdings.length === 0 ? (
          <p className="px-5 py-8 text-sm text-muted">No holdings yet. Add your first investment above.</p>
        ) : (
          <table className="mt-3 w-full">
            <thead className="border-b border-line">
              <tr>
                <th className="th">Name</th>
                <th className="th">Type</th>
                <th className="th text-right">Quantity</th>
                <th className="th text-right">Avg cost</th>
                <th className="th text-right">Invested</th>
                <th className="th" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {pf.holdings.map((h) => (
                <tr key={h.id}>
                  <td className="td font-medium">{h.name}</td>
                  <td className="td text-muted">{ASSET_RULES[h.type].label}</td>
                  <td className="td text-right">{formatQty(h.qty)}</td>
                  <td className="td text-right">{formatINR(h.avgCost)}</td>
                  <td className="td text-right">{formatINR(h.cost)}</td>
                  <td className="td text-right">
                    <Link href={`/sell/${h.id}`} className="btn-accent !py-1">
                      Sell
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
