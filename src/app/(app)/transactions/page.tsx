import { ASSET_RULES } from "@/domain/taxRules";
import { requireUser } from "@/features/auth/session";
import { deleteLotAction } from "@/features/holdings/actions";
import { loadPortfolio } from "@/features/portfolio/data";
import { deleteSaleAction } from "@/features/sales/actions";
import { formatDate, formatINR, formatQty } from "@/lib/format";

export default async function TransactionsPage() {
  const user = await requireUser();
  const pf = await loadPortfolio(user.id);
  const assetMap = new Map(pf.assets.map((a) => [a.id, a]));

  const txns = [
    ...pf.lots.map((l) => ({
      id: l.id,
      kind: "buy" as const,
      date: l.buyDate,
      asset: assetMap.get(l.assetId),
      qty: l.qty,
      price: l.unitPrice,
      fees: l.fees,
      locked: (pf.sold.get(l.id) ?? 0) > 0,
    })),
    ...pf.saleEvents.map((s) => ({
      id: s.id,
      kind: "sell" as const,
      date: s.date,
      asset: assetMap.get(s.assetId),
      qty: s.qty,
      price: s.price,
      fees: s.fees,
      locked: false,
    })),
  ].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  return (
    <section className="card overflow-x-auto p-0">
      <h1 className="px-5 pt-5 text-lg font-semibold text-primary-strong">All transactions</h1>
      {txns.length === 0 ? (
        <p className="px-5 py-8 text-sm text-muted">Nothing here yet.</p>
      ) : (
        <table className="mt-3 w-full">
          <thead className="border-b border-line">
            <tr>
              <th className="th">Date</th>
              <th className="th">Action</th>
              <th className="th">Asset</th>
              <th className="th text-right">Qty</th>
              <th className="th text-right">Price</th>
              <th className="th text-right">Fees</th>
              <th className="th" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {txns.map((t) => (
              <tr key={t.kind + t.id}>
                <td className="td">{formatDate(t.date)}</td>
                <td className="td">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      t.kind === "buy" ? "bg-primary-soft text-primary-strong" : "bg-accent/20 text-accent-strong"
                    }`}
                  >
                    {t.kind === "buy" ? "Buy" : "Sell"}
                  </span>
                </td>
                <td className="td">
                  {t.asset?.name}
                  <span className="ml-2 text-xs text-muted">{t.asset ? ASSET_RULES[t.asset.type].label : ""}</span>
                </td>
                <td className="td text-right">{formatQty(t.qty)}</td>
                <td className="td text-right">{formatINR(t.price)}</td>
                <td className="td text-right">{formatINR(t.fees)}</td>
                <td className="td text-right">
                  {t.locked ? (
                    <span className="text-xs text-muted" title="Delete the related sale first">
                      In use
                    </span>
                  ) : (
                    <form action={t.kind === "buy" ? deleteLotAction : deleteSaleAction}>
                      <input type="hidden" name="id" value={t.id} />
                      <button className="text-sm text-loss hover:underline">Delete</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
