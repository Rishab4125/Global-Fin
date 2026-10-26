import { ArrowLeft, Pencil } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteButton } from "@/components/DeleteButton";
import { EmptyState, Kpi, PageHeader, SectionCard } from "@/components/ui";
import { ASSET_RULES } from "@/domain/taxRules";
import { requireUser } from "@/features/auth/session";
import { AssetEditor } from "@/features/holdings/AssetEditor";
import { deleteLotAction } from "@/features/holdings/actions";
import { loadPortfolio } from "@/features/portfolio/data";
import { deleteSaleAction } from "@/features/sales/actions";
import { formatDate, formatINR, formatQty, gainClass } from "@/lib/format";
import { ArrowLeftRight } from "lucide-react";

export default async function HoldingDetailPage({ params }: { params: Promise<{ assetId: string }> }) {
  const { assetId } = await params;
  const user = await requireUser();
  const pf = await loadPortfolio(user.id);

  const asset = pf.assets.find((a) => a.id === assetId);
  if (!asset) notFound();
  const rule = ASSET_RULES[asset.type];

  const lots = pf.lots.filter((l) => l.assetId === assetId).sort((a, b) => (a.buyDate < b.buyDate ? 1 : -1));
  const sales = pf.saleEvents.filter((s) => s.assetId === assetId).sort((a, b) => (a.date < b.date ? 1 : -1));
  const rowById = new Map(pf.rows.map((r) => [r.id, r]));
  const holding = pf.holdings.find((h) => h.id === assetId);
  const realised = sales.reduce((s, x) => s + (rowById.get(x.id)?.gain ?? 0), 0);
  const tax = sales.reduce((s, x) => s + (rowById.get(x.id)?.tax ?? 0), 0);

  return (
    <div>
      <Link href="/holdings" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft size={15} />
        Holdings
      </Link>
      <PageHeader
        title={asset.name}
        description={rule.label}
        actions={
          holding ? (
            <Link href={`/sell/${asset.id}`} className="btn-primary">
              Sell
            </Link>
          ) : undefined
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Kpi label="Quantity held" value={formatQty(holding?.qty ?? 0)} />
        <Kpi label="Average cost" value={formatINR(holding?.avgCost ?? 0)} />
        <Kpi label="Invested" value={formatINR(holding?.cost ?? 0)} />
        <Kpi
          label="Realised gain"
          value={formatINR(realised)}
          tone={realised >= 0 ? "gain" : "loss"}
          hint={`Estimated tax ${formatINR(tax)}`}
        />
      </div>

      <div className="mt-6 space-y-5">
        <AssetEditor assetId={asset.id} name={asset.name} type={asset.type} />

        <SectionCard title="Purchases" description="Click Edit to change a purchase" flush>
          {lots.length === 0 ? (
            <EmptyState icon={ArrowLeftRight} title="No purchases" />
          ) : (
            <table className="w-full">
              <thead>
                <tr>
                  <th className="th">Date</th>
                  <th className="th text-right">Quantity</th>
                  <th className="th text-right">Price</th>
                  <th className="th text-right">Fees</th>
                  <th className="th text-right">Sold</th>
                  <th className="th text-right">Remaining</th>
                  <th className="th" />
                </tr>
              </thead>
              <tbody>
                {lots.map((l) => {
                  const sold = pf.sold.get(l.id) ?? 0;
                  return (
                    <tr key={l.id}>
                      <td className="td">{formatDate(l.buyDate)}</td>
                      <td className="td text-right">{formatQty(l.qty)}</td>
                      <td className="td text-right">{formatINR(l.unitPrice)}</td>
                      <td className="td text-right">{formatINR(l.fees)}</td>
                      <td className="td text-right">{formatQty(sold)}</td>
                      <td className="td text-right font-medium">{formatQty(l.qty - sold)}</td>
                      <td className="td">
                        <div className="flex justify-end gap-2">
                          <Link href={`/holdings/${asset.id}/lots/${l.id}`} aria-label="Edit" title="Edit" className="btn-ghost !h-8 !px-2.5">
                            <Pencil size={14} />
                            <span className="hidden sm:inline">Edit</span>
                          </Link>
                          {sold > 0 ? (
                            <span className="grid h-8 place-items-center px-2 text-xs text-muted" title="Delete the sales first">
                              Has sales
                            </span>
                          ) : (
                            <DeleteButton
                              compact
                              action={deleteLotAction}
                              id={l.id}
                              confirmText="Delete this purchase? This cannot be undone."
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </SectionCard>

        <SectionCard title="Sales" description="Gains use FIFO matching and your slab rate" flush>
          {sales.length === 0 ? (
            <EmptyState icon={ArrowLeftRight} title="No sales yet" text="Sales you record for this holding appear here." />
          ) : (
            <table className="w-full">
              <thead>
                <tr>
                  <th className="th">Date</th>
                  <th className="th text-right">Quantity</th>
                  <th className="th text-right">Price</th>
                  <th className="th text-right">Fees</th>
                  <th className="th">Tax</th>
                  <th className="th text-right">Gain</th>
                  <th className="th text-right">Tax</th>
                  <th className="th text-right">Net</th>
                  <th className="th" />
                </tr>
              </thead>
              <tbody>
                {sales.map((s) => {
                  const r = rowById.get(s.id);
                  return (
                    <tr key={s.id}>
                      <td className="td">{formatDate(s.date)}</td>
                      <td className="td text-right">{formatQty(s.qty)}</td>
                      <td className="td text-right">{formatINR(s.price)}</td>
                      <td className="td text-right">{formatINR(s.fees)}</td>
                      <td className="td">
                        <span className={`badge ${s.applyTax ? "bg-primary-soft text-primary-strong" : "bg-surface2 text-muted"}`}>
                          {s.applyTax ? "Applied" : "Not applied"}
                        </span>
                      </td>
                      <td className={`td text-right ${gainClass(r?.gain ?? 0)}`}>{formatINR(r?.gain ?? 0)}</td>
                      <td className="td text-right">{formatINR(r?.tax ?? 0)}</td>
                      <td className={`td text-right font-medium ${gainClass(r?.netGain ?? 0)}`}>{formatINR(r?.netGain ?? 0)}</td>
                      <td className="td">
                        <div className="flex justify-end gap-2">
                          <Link href={`/holdings/${asset.id}/sales/${s.id}`} aria-label="Edit" title="Edit" className="btn-ghost !h-8 !px-2.5">
                            <Pencil size={14} />
                            <span className="hidden sm:inline">Edit</span>
                          </Link>
                          <DeleteButton
                            compact
                            action={deleteSaleAction}
                            id={s.id}
                            confirmText="Delete this sale? The units return to your holding."
                          />
                        </div>
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
