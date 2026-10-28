import { ArrowLeft, ArrowLeftRight, Pencil } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Amount } from "@/components/Amount";
import { DeleteButton } from "@/components/DeleteButton";
import { SegmentLinks } from "@/components/SegmentLinks";
import { EmptyState, Kpi, PageHeader, SectionCard } from "@/components/ui";
import { EVENT_TYPES, splitFactor, unitsNow } from "@/domain/corporateActions";
import { todayIso } from "@/domain/dates";
import { ASSET_RULES } from "@/domain/taxRules";
import { requireUser } from "@/features/auth/session";
import { deleteEventAction } from "@/features/events/actions";
import { AddEventForm } from "@/features/events/AddEventForm";
import { deleteHoldingAction, deleteLotAction } from "@/features/holdings/actions";
import { AssetDetailsForm } from "@/features/holdings/AssetDetailsForm";
import { AssetEditor } from "@/features/holdings/AssetEditor";
import { detailRows, lotTerms, splitByTerm } from "@/features/holdings/detail";
import { buildHoldingRows } from "@/features/holdings/list";
import { loadPortfolio } from "@/features/portfolio/data";
import { deleteSaleAction } from "@/features/sales/actions";
import { formatDate, formatINR, formatINRWhole, formatPercent, formatPrice, formatQty, gainClass } from "@/lib/format";

export const metadata = { title: "Holding" };

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "lots", label: "Lots" },
  { id: "sales", label: "Sales" },
  { id: "events", label: "Events" },
  { id: "info", label: "Info" },
] as const;
type Tab = (typeof TABS)[number]["id"];

export default async function HoldingDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ assetId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { assetId } = await params;
  const { tab: tabParam } = await searchParams;
  const tab: Tab = TABS.find((t) => t.id === tabParam)?.id ?? "overview";
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

  const terms = lotTerms(lots, pf.sold, rule.longTermMonths, today, factorNow);
  const termSplit = splitByTerm(terms);
  const where =
    buildHoldingRows(lots, pf.sold, new Map([[asset.id, { id: asset.id, type: asset.type, name: asset.name, tags: asset.tags }]]), new Map([[assetId, factorNow]]))
      .rows[0]?.byPlatform ?? [];
  const platformNames = [...new Set(lots.map((l) => l.platform ?? "Other"))].sort();

  const describe = (e: (typeof events)[number]) =>
    e.type === "split"
      ? `Split ${e.ratioOld}:${e.ratioNew}. Each share became ${splitFactor(e)}. Total cost and buy dates are unchanged.`
      : e.type === "bonus"
        ? `Bonus ${e.ratioNew} for every ${e.ratioOld} held. The new shares cost nothing and their holding period starts on this date.`
        : `Dividend of ${formatINR(e.amount)}${e.tds > 0 ? `, TDS ${formatINR(e.tds)}` : ""}. Taxed at your slab rate.`;

  const base = `/holdings/${assetId}`;

  return (
    <div>
      <Link href="/holdings" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft size={15} />
        Holdings
      </Link>
      <PageHeader
        title={asset.name}
        description={`${rule.category} · ${rule.subType}${platformNames.length ? ` · ${platformNames.join(", ")}` : ""}`}
        actions={
          holding ? (
            <Link href={`/sell/${asset.id}`} className="btn-primary">
              Record sale
            </Link>
          ) : undefined
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Kpi label="Invested · as of today" value={<Amount>{formatINRWhole(holding?.cost ?? 0)}</Amount>} />
        <Kpi label="Quantity held" value={formatQty(holding?.qty ?? 0, asset.type)} />
        <Kpi label="Average cost" value={<Amount>{formatPrice(holding?.avgCost ?? 0, { crypto: asset.type === "crypto" })}</Amount>} />
        <Kpi
          label="Realised gain"
          value={<Amount>{formatINRWhole(realised, { sign: true })}</Amount>}
          tone={realised > 0 ? "gain" : realised < 0 ? "loss" : "default"}
          hint={<>Estimated tax <Amount>{formatINRWhole(tax)}</Amount></>}
        />
      </div>

      <div className="mt-6">
        <SegmentLinks
          label="Holding sections"
          items={TABS.map((t) => ({
            href: t.id === "overview" ? base : `${base}?tab=${t.id}`,
            label: t.label,
            active: t.id === tab,
          }))}
        />
      </div>

      <div className="space-y-5">
        {tab === "overview" && (
          <>
            <SectionCard
              title="Holding period"
              description={
                rule.longTermMonths === null
                  ? "Gains on this type are taxed the same however long you hold it."
                  : `A sale is long term after more than ${rule.longTermMonths} months. Shows when each purchase gets there.`
              }
              flush
            >
              {terms.length === 0 ? (
                <p className="px-5 py-6 text-sm text-muted">Nothing held.</p>
              ) : (
                <>
                  {rule.longTermMonths !== null && (
                    <div className="grid grid-cols-2 gap-4 border-b border-line px-5 py-4">
                      <div>
                        <p className="t-label">Short term now</p>
                        <p className="t-body-strong num mt-0.5">
                          {formatQty(termSplit.shortQty, asset.type)} · <Amount>{formatINRWhole(termSplit.shortCost)}</Amount>
                        </p>
                      </div>
                      <div>
                        <p className="t-label">Long term now</p>
                        <p className="t-body-strong num mt-0.5">
                          {formatQty(termSplit.longQty, asset.type)} · <Amount>{formatINRWhole(termSplit.longCost)}</Amount>
                        </p>
                      </div>
                    </div>
                  )}
                  <ul className="divide-y divide-line">
                    {terms.map((t) => (
                      <li key={t.id} className="flex items-center justify-between gap-3 px-5 py-3">
                        <span className="min-w-0">
                          <span className="t-body-strong block">{formatDate(t.buyDate)}</span>
                          <span className="t-caption num block">
                            {formatQty(t.qty, asset.type)} left · <Amount>{formatINRWhole(t.cost)}</Amount>
                          </span>
                        </span>
                        {t.term === "long" && <span className="badge-gain shrink-0">Long term</span>}
                        {t.term === "short" && (
                          <span className="badge-warn shrink-0 text-right">
                            Long term from {formatDate(t.longFrom!)}
                            {t.daysToLong !== null && ` (${t.daysToLong} day${t.daysToLong === 1 ? "" : "s"})`}
                          </span>
                        )}
                        {t.term === "none" && <span className="badge-muted shrink-0">No holding-period rule</span>}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </SectionCard>

            <div className="grid gap-5 lg:grid-cols-2">
              <SectionCard title="Where it is held" description="By what you paid." flush>
                {where.length === 0 ? (
                  <p className="px-5 py-6 text-sm text-muted">Nothing held.</p>
                ) : (
                  <ul className="divide-y divide-line">
                    {where.map((p) => (
                      <li key={p.platform} className="flex items-center justify-between gap-3 px-5 py-3">
                        <span className="min-w-0">
                          <span className="t-body-strong block truncate">{p.platform}</span>
                          <span className="t-caption num block">{formatQty(p.qty, asset.type)}</span>
                        </span>
                        <span className="shrink-0 text-right">
                          <span className="t-body-strong num block">
                            <Amount>{formatINRWhole(p.cost)}</Amount>
                          </span>
                          <span className="t-caption num block">
                            {formatPercent(holding && holding.cost > 0 ? (p.cost / holding.cost) * 100 : 0)}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </SectionCard>

              <SectionCard title="What you realised" description="Sales and dividends on this holding.">
                <dl className="grid grid-cols-2 gap-4">
                  <div>
                    <dt className="t-label">Realised gain</dt>
                    <dd className={`t-body-strong num mt-0.5 ${gainClass(realised)}`}>
                      <Amount>{formatINRWhole(realised, { sign: true })}</Amount>
                    </dd>
                  </div>
                  <div>
                    <dt className="t-label">Estimated tax</dt>
                    <dd className="t-body-strong num mt-0.5">
                      <Amount>{formatINRWhole(tax)}</Amount>
                    </dd>
                  </div>
                  <div>
                    <dt className="t-label">Post-tax gain</dt>
                    <dd className={`t-body-strong num mt-0.5 ${gainClass(realised - tax)}`}>
                      <Amount>{formatINRWhole(realised - tax, { sign: true })}</Amount>
                    </dd>
                  </div>
                  <div>
                    <dt className="t-label">Dividends</dt>
                    <dd className="t-body-strong num mt-0.5">
                      <Amount>{formatINRWhole(dividendTotal)}</Amount>
                    </dd>
                  </div>
                </dl>
              </SectionCard>
            </div>
          </>
        )}

        {tab === "lots" && (
          <SectionCard title="Purchases" description="Click Edit to change a purchase" flush>
            {hasSplit && (
              <p className="t-caption border-b border-line bg-surface2 px-5 py-2">
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
                    <th className="th hidden md:table-cell">Platform</th>
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
                        <td className="td hidden text-muted md:table-cell">{l.platform ?? "Other"}</td>
                        <td className="td text-right">{formatQty(l.qty * f, asset.type)}</td>
                        <td className="td text-right">
                          <Amount>{formatPrice(l.unitPrice / f, { crypto: asset.type === "crypto" })}</Amount>
                        </td>
                        <td className="td hidden text-right md:table-cell">{l.fees ? <Amount>{formatINR(l.fees)}</Amount> : "–"}</td>
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
                                <Link
                                  href={`/holdings/${asset.id}/lots/${l.id}`}
                                  aria-label={`Edit purchase on ${formatDate(l.buyDate)}`}
                                  title="Edit"
                                  className="btn-ghost !h-8 !px-2.5"
                                >
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
        )}

        {tab === "sales" && (
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
                        <td className="td sticky-col">
                          {formatDate(s.date)}
                          {s.buyback && (
                            <span className="badge-warn ml-2">
                              Buyback{s.tenderedQty ? ` ${s.qty}/${s.tenderedQty}` : ""}
                            </span>
                          )}
                        </td>
                        <td className="td text-right">{formatQty(s.qty, asset.type)}</td>
                        <td className="td text-right">
                          <Amount>{formatPrice(s.price, { crypto: asset.type === "crypto" })}</Amount>
                        </td>
                        <td className="td hidden text-right md:table-cell">{s.fees ? <Amount>{formatINR(s.fees)}</Amount> : "–"}</td>
                        <td className="td hidden md:table-cell">
                          <span className={s.applyTax ? "badge-gain" : "badge-muted"}>{s.applyTax ? "Applied" : "Not applied"}</span>
                        </td>
                        <td className={`td text-right ${gainClass(r?.gain ?? 0)}`}>
                          <Amount>{formatINR(r?.gain ?? 0)}</Amount>
                        </td>
                        <td className="td text-right">
                          <Amount>{formatINR(r?.tax ?? 0)}</Amount>
                        </td>
                        <td className={`td text-right font-medium ${gainClass(r?.netGain ?? 0)}`}>
                          <Amount>{formatINR(r?.netGain ?? 0)}</Amount>
                        </td>
                        <td className="td">
                          <div className="flex justify-end gap-2">
                            <Link
                              href={`/holdings/${asset.id}/sales/${s.id}`}
                              aria-label={`Edit sale on ${formatDate(s.date)}`}
                              title="Edit"
                              className="btn-ghost !h-8 !px-2.5"
                            >
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
        )}

        {tab === "events" && (
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
        )}

        {tab === "info" && (
          <>
            <SectionCard title="About this holding">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-4 lg:grid-cols-4">
                <Fact label="Category" value={rule.category} />
                <Fact label="Sub-type" value={rule.subType} />
                <Fact label="Exposure" value={rule.exposure} />
                <Fact label="Held on" value={platformNames.join(", ") || "–"} />
                {detailRows(asset.type, asset.isin, asset.details).map((r) => (
                  <Fact key={r.label} label={r.label} value={r.value} />
                ))}
                <Fact label="Tags" value={asset.tags.length ? asset.tags.map((t) => `#${t}`).join(" ") : "None"} />
              </dl>
              {asset.notes && (
                <div className="mt-4 border-t border-line pt-4">
                  <p className="t-label">Notes</p>
                  <p className="t-body mt-1">{asset.notes}</p>
                </div>
              )}
              <p className="t-caption mt-4">Tax: {rule.note}</p>
            </SectionCard>

            <SectionCard title="Edit details" description="Fill in what you left out when you added it.">
              <AssetDetailsForm
                key={JSON.stringify([asset.details, asset.tags, asset.notes, asset.isin])}
                assetId={asset.id}
                type={asset.type}
                isin={asset.isin}
                details={asset.details}
                tags={asset.tags}
                notes={asset.notes}
              />
            </SectionCard>

            <AssetEditor assetId={asset.id} name={asset.name} type={asset.type} />

            <SectionCard title="Delete this holding" description="Removes it with all its purchases, sales, events and realised gains.">
              <DeleteButton
                action={deleteHoldingAction}
                id={asset.id}
                label="Delete holding"
                confirmText={`Delete ${asset.name}? This also deletes its purchases, sales and realised gains. This cannot be undone.`}
              />
            </SectionCard>
          </>
        )}
      </div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="t-caption">{label}</dt>
      <dd className="t-body-strong mt-0.5 break-words">{value}</dd>
    </div>
  );
}
