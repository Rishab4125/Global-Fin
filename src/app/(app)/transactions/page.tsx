import { ArrowLeftRight, Pencil } from "lucide-react";
import Link from "next/link";
import { EmptyState, PageHeader, SectionCard } from "@/components/ui";
import { ASSET_RULES } from "@/domain/taxRules";
import { requireUser } from "@/features/auth/session";
import { loadPortfolio } from "@/features/portfolio/data";
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
    })),
    ...pf.saleEvents.map((s) => ({
      id: s.id,
      kind: "sell" as const,
      date: s.date,
      asset: assetMap.get(s.assetId),
      qty: s.qty,
      price: s.price,
      fees: s.fees,
    })),
  ].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  return (
    <div>
      <PageHeader title="Transactions" description="Every purchase and sale. Open a holding to edit or delete entries." />
      <SectionCard flush>
        {txns.length === 0 ? (
          <EmptyState icon={ArrowLeftRight} title="No transactions yet" text="Add an investment to get started." />
        ) : (
          <table className="w-full">
            <thead>
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
            <tbody>
              {txns.map((t) => (
                <tr key={t.kind + t.id}>
                  <td className="td">{formatDate(t.date)}</td>
                  <td className="td">
                    <span
                      className={`badge ${
                        t.kind === "buy" ? "bg-primary-soft text-primary-strong" : "bg-accent/15 text-accent-strong"
                      }`}
                    >
                      {t.kind === "buy" ? "Buy" : "Sell"}
                    </span>
                  </td>
                  <td className="td">
                    {t.asset ? (
                      <Link href={`/holdings/${t.asset.id}`} className="font-medium hover:text-primary hover:underline">
                        {t.asset.name}
                      </Link>
                    ) : (
                      "Unknown"
                    )}
                    <span className="ml-2 text-xs text-muted">{t.asset ? ASSET_RULES[t.asset.type].label : ""}</span>
                  </td>
                  <td className="td text-right">{formatQty(t.qty)}</td>
                  <td className="td text-right">{formatINR(t.price)}</td>
                  <td className="td text-right">{formatINR(t.fees)}</td>
                  <td className="td text-right">
                    {t.asset && (
                      <Link
                        href={`/holdings/${t.asset.id}/${t.kind === "buy" ? "lots" : "sales"}/${t.id}`}
                        className="btn-ghost !h-8 !px-2.5"
                      >
                        <Pencil size={14} />
                        Edit
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </SectionCard>
    </div>
  );
}
