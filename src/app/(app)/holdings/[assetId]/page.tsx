import { ArrowLeft, Pencil } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteButton } from "@/components/DeleteButton";
import { EmptyState, Kpi, PageHeader, SectionCard } from "@/components/ui";
import { todayIso } from "@/domain/dates";
import { EVENT_TYPES, splitFactor, unitsNow } from "@/domain/corporateActions";
import { ASSET_RULES } from "@/domain/taxRules";
import { requireUser } from "@/features/auth/session";
import { deleteEventAction } from "@/features/events/actions";
import { AddEventForm } from "@/features/events/AddEventForm";
import { AssetEditor } from "@/features/holdings/AssetEditor";
import { deleteLotAction } from "@/features/holdings/actions";
import { loadPortfolio } from "@/features/portfolio/data";
import { deleteSaleAction } from "@/features/sales/actions";
import { formatDate, formatINR, formatQty, gainClass } from "@/lib/format";
import { ArrowLeftRight } from "lucide-react";

export const metadata = { title: "Holding" };

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
  const today = todayIso();
  const factorNow = unitsNow(pf.actions, today).get(assetId) ?? 1;
  const events = pf.actions.filter((a) => a.assetId === assetId).sort((a, b) => (a.date < b.date ? 1 : -1));
  const eventTypes = EVENT_TYPES[asset.type] ?? [];
  const dividendTotal = events.filter((e) => e.type === "dividend").reduce((s, e) => s + e.amount, 0);
  const hasSplit = factorNow !== 1;
  const describe = (e: (typeof events)[number]) =>
    e.type === "split"
      ? `Split ${e.ratioOld}:${e.ratioNew}. Each share became ${splitFactor(e)}. Total cost and buy dates are unchanged.`
      : e.type === "bonus"
        ? `Bonus ${e.ratioNew} for every ${e.ratioOld} held. The new shares cost nothing and their holding period starts on this date.`
        : `Dividend of ${formatINR(e.amount)}${e.tds > 0 ? `, TDS ${formatINR(e.tds)}` : ""}. Taxed at your slab rate.`;

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
          {hasSplit && (
            <p className="border-b border-line bg-surface2 px-5 py-2 text-xs text-muted">
              Quantities and prices are shown in today&apos;s units, after your splits. Edit shows what you originally entered.
            </p>
          )}
          {lots.length === 0 ? (
            <EmptyState icon={ArrowLeftRight} title="No purchases" />
          ) : (
            <table className="w-full">
              <thead>
                <tr>
                  <th className="th sticky-col">Date</th>
                  <th className="th text-right">Quantity</th>
                  <th className="th text-right">Price</th>
                  <th className="th hidden text-right md:table-cell">Fees</th>
                  <th className="th text-right">Sold</th>
                  <th className="th text-right">Remaining</th>
                  <th className="th" />
                </tr>
              </thead>
              <tbody>
                {lots.map((l) => {
                  const sold = pf.sold.get(l.id) ?? 0;
                  const f = factorNow / (l.u ?? 1);
                  return (
                    <tr key={l.id}>
                      <td className="td sticky-col">
                        {formatDate(l.buyDate)}
                        {l.eventId && <span className="badge-warn ml-2">Bonus</span>}
                      </td>
                      <td className="td text-right">{formatQty(l.qty * f, asset.type)}</td>
                      <td className="td text-right">{formatINR(l.unitPrice / f)}</td>
                      <td className="td hidden text-right md:table-cell">{l.fees ? formatINR(l.fees) : "–"}</td>
                      <td className="td text-right">{formatQty(sold * f, asset.type)}</td>
                      <td className="td text-right font-medium">{formatQty((l.qty - sold) * f, asset.type)}</td>
                      <td className="td">
                        <div className="flex justify-end gap-2">
                          {l.eventId ? (
                            <span className="grid h-8 place-items-center px-2 text-xs text-muted" title="Reverse the bonus event to remove these shares">
                              From event
                            </span>
                          ) : (
                            <>
                          <Link href={`/holdings/${asset.id}/lots/${l.id}`} aria-label={`Edit purchase on ${formatDate(l.buyDate)}`} title="Edit" className="btn-ghost !h-8 !px-2.5">
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
                              ariaLabel={`Delete purchase on ${formatDate(l.buyDate)}`}
                              action={deleteLotAction}
                              id={l.id}
                              confirmText="Delete this purchase? This cannot be undone."
                            />
                          )}
                            </>
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

        <SectionCard
          title="Events"
          description={
            eventTypes.length
              ? `Splits, bonus issues and dividends${dividendTotal > 0 ? ` · dividends so far ${formatINR(dividendTotal)}` : ""}. Each can be reversed.`
              : "Splits, bonus issues and dividends are recorded on stocks and ETFs."
          }
          flush
        >
          {events.length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted">No events recorded yet.</p>
          ) : (
            <ul>
              {events.map((e) => (
                <li key={e.id} className="flex items-start justify-between gap-3 border-b border-line px-5 py-3 last:border-0">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={e.type === "dividend" ? "badge-gain" : "badge-warn"}>
                        {e.type === "split" ? "Split" : e.type === "bonus" ? "Bonus" : "Dividend"}
                      </span>
                      <span className="text-sm font-medium">{formatDate(e.date)}</span>
                    </div>
                    <p className="mt-1 text-sm text-muted">{describe(e)}</p>
                  </div>
                  <DeleteButton
                    compact
                    label="Reverse"
                    ariaLabel={`Reverse ${e.type} on ${formatDate(e.date)}`}
                    action={deleteEventAction}
                    id={e.id}
                    confirmText={
                      e.type === "bonus"
                        ? "Reverse this bonus? The bonus shares are removed."
                        : e.type === "split"
                          ? "Reverse this split? Quantities and prices return to what you entered."
                          : "Delete this dividend?"
                    }
                  />
                </li>
              ))}
            </ul>
          )}
          {eventTypes.length > 0 && <AddEventForm assetId={asset.id} today={today} types={eventTypes} />}
        </SectionCard>

        <SectionCard title="Sales" description="Gains use FIFO matching and your slab rate" flush>
          {sales.length === 0 ? (
            <EmptyState icon={ArrowLeftRight} title="No sales yet" text="Sales you record for this holding appear here." />
          ) : (
            <table className="w-full">
              <thead>
                <tr>
                  <th className="th sticky-col">Date</th>
                  <th className="th text-right">Quantity</th>
                  <th className="th text-right">Price</th>
                  <th className="th hidden text-right md:table-cell">Fees</th>
                  <th className="th hidden md:table-cell">Tax</th>
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
                      <td className="td sticky-col">{formatDate(s.date)}</td>
                      <td className="td text-right">{formatQty(s.qty)}</td>
                      <td className="td text-right">{formatINR(s.price)}</td>
                      <td className="td hidden text-right md:table-cell">{s.fees ? formatINR(s.fees) : "–"}</td>
                      <td className="td hidden md:table-cell">
                        <span className={s.applyTax ? "badge-gain" : "badge-muted"}>
                          {s.applyTax ? "Applied" : "Not applied"}
                        </span>
                      </td>
                      <td className={`td text-right ${gainClass(r?.gain ?? 0)}`}>{formatINR(r?.gain ?? 0)}</td>
                      <td className="td text-right">{formatINR(r?.tax ?? 0)}</td>
                      <td className={`td text-right font-medium ${gainClass(r?.netGain ?? 0)}`}>{formatINR(r?.netGain ?? 0)}</td>
                      <td className="td">
                        <div className="flex justify-end gap-2">
                          <Link href={`/holdings/${asset.id}/sales/${s.id}`} aria-label={`Edit sale on ${formatDate(s.date)}`} title="Edit" className="btn-ghost !h-8 !px-2.5">
                            <Pencil size={14} />
                            <span className="hidden sm:inline">Edit</span>
                          </Link>
                          <DeleteButton
                            compact
                            ariaLabel={`Delete sale on ${formatDate(s.date)}`}
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
