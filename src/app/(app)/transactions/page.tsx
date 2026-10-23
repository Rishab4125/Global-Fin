import { ArrowLeftRight, Pencil } from "lucide-react";
import Link from "next/link";
import { EmptyState, PageHeader, SectionCard } from "@/components/ui";
import { ASSET_RULES, type AssetTypeId } from "@/domain/taxRules";
import { requireUser } from "@/features/auth/session";
import { loadPortfolio } from "@/features/portfolio/data";
import { formatDate, formatINR, formatQty, gainClass } from "@/lib/format";

type Kind = "buy" | "sell" | "misc" | "buyback";

interface Txn {
  key: string;
  id: string;
  kind: Kind;
  date: string;
  assetId?: string;
  name: string;
  typeLabel: string;
  qty: number | null;
  price: number | null;
  fees: number;
  /** Signed amount: cost for buys, proceeds for sells, gain/loss for misc, proceeds for buybacks. */
  amount: number;
  note?: string;
}

const badge: Record<Kind, { label: string; className: string }> = {
  buy: { label: "Buy", className: "bg-primary-soft text-primary-strong" },
  sell: { label: "Sell", className: "bg-accent/15 text-accent-strong" },
  misc: { label: "Misc P/L", className: "bg-surface2 text-muted" },
  buyback: { label: "Buyback", className: "bg-accent/15 text-accent-strong" },
};

export default async function TransactionsPage() {
  const user = await requireUser();
  const pf = await loadPortfolio(user.id);
  const assetMap = new Map(pf.assets.map((a) => [a.id, a]));
  const typeLabel = (t: AssetTypeId) => ASSET_RULES[t].label;

  const txns: Txn[] = [
    ...pf.lots.map((l): Txn => {
      const a = assetMap.get(l.assetId);
      return {
        key: `buy-${l.id}`,
        id: l.id,
        kind: "buy",
        date: l.buyDate,
        assetId: l.assetId,
        name: a?.name ?? "Unknown",
        typeLabel: a ? typeLabel(a.type) : "",
        qty: l.qty,
        price: l.unitPrice,
        fees: l.fees,
        amount: l.qty * l.unitPrice,
      };
    }),
    ...pf.saleEvents.map((s): Txn => {
      const a = assetMap.get(s.assetId);
      return {
        key: `sell-${s.id}`,
        id: s.id,
        kind: "sell",
        date: s.date,
        assetId: s.assetId,
        name: a?.name ?? "Unknown",
        typeLabel: a ? typeLabel(a.type) : "",
        qty: s.qty,
        price: s.price,
        fees: s.fees,
        amount: s.qty * s.price,
      };
    }),
    ...pf.miscEvents.map((m): Txn => {
      const buyback = m.entryType === "buyback";
      return {
        key: `misc-${m.id}`,
        id: m.id,
        kind: buyback ? "buyback" : "misc",
        date: m.date,
        name: buyback ? "Share buyback" : "Misc profit / loss",
        typeLabel: buyback ? `Cost ${formatINR(m.cost)}` : typeLabel(m.assetType),
        qty: null,
        price: null,
        fees: m.brokerage,
        amount: m.amount,
        note: m.note,
      };
    }),
  ].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  return (
    <div>
      <PageHeader
        title="Transactions"
        description="Every purchase, sale and misc entry. Open a holding to edit or delete its entries."
      />
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
                <th className="th text-right">Amount</th>
                <th className="th" />
              </tr>
            </thead>
            <tbody>
              {txns.map((t) => (
                <tr key={t.key}>
                  <td className="td">{formatDate(t.date)}</td>
                  <td className="td">
                    <span className={`badge ${badge[t.kind].className}`}>{badge[t.kind].label}</span>
                  </td>
                  <td className="td">
                    {t.assetId ? (
                      <Link href={`/holdings/${t.assetId}`} className="font-medium hover:text-primary hover:underline">
                        {t.name}
                      </Link>
                    ) : (
                      <span className="font-medium">{t.name}</span>
                    )}
                    <span className="ml-2 text-xs text-muted">{t.typeLabel}</span>
                  </td>
                  <td className="td text-right">{t.qty === null ? "–" : formatQty(t.qty)}</td>
                  <td className="td text-right">{t.price === null ? "–" : formatINR(t.price)}</td>
                  <td className="td text-right">{formatINR(t.fees)}</td>
                  <td className={`td text-right font-medium ${t.kind === "misc" ? gainClass(t.amount) : ""}`}>
                    {formatINR(t.amount)}
                  </td>
                  <td className="td text-right">
                    {t.assetId ? (
                      <Link
                        href={`/holdings/${t.assetId}/${t.kind === "buy" ? "lots" : "sales"}/${t.id}`}
                        className="btn-ghost !h-8 !px-2.5"
                      >
                        <Pencil size={14} />
                        Edit
                      </Link>
                    ) : (
                      <Link href="/misc" className="btn-ghost !h-8 !px-2.5">
                        Manage
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
