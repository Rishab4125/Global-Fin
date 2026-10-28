import { Coins } from "lucide-react";
import Link from "next/link";
import { Amount, ResponsiveAmount } from "@/components/Amount";
import { FilterBar } from "@/components/FilterBar";
import { HideAmountsButton } from "@/components/HideAmountsButton";
import { SegmentLinks } from "@/components/SegmentLinks";
import { EmptyState, SectionCard } from "@/components/ui";
import { todayIso } from "@/domain/dates";
import { fyOptions, inPeriod, resolvePeriod } from "@/domain/period";
import { ASSET_RULES } from "@/domain/taxRules";
import { requireUser } from "@/features/auth/session";
import { GainByYearChart, MIX_COLORS, MixDonut } from "@/features/dashboard/Charts";
import { computeMix, MIX_VIEWS, rowsFor, upcomingMaturities, type MixView } from "@/features/dashboard/mix";
import { PeriodFilter } from "@/features/dashboard/PeriodFilter";
import { loadPortfolio } from "@/features/portfolio/data";
import { byFinancialYear, totals } from "@/features/reports/summary";
import { filterQs, passes, readFilters } from "@/lib/filters";
import { formatDate, formatINRCompact, formatINRWhole, formatPercent, gainClass } from "@/lib/format";

export const metadata = { title: "Dashboard" };

type Query = { period?: string; from?: string; to?: string; ty?: string; pf?: string; mix?: string };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<Query> }) {
  const query = await searchParams;
  const user = await requireUser();
  const pf = await loadPortfolio(user.id);
  const today = todayIso();

  const allDates = [
    ...pf.lots.map((l) => l.buyDate),
    ...pf.saleEvents.map((s) => s.date),
    ...pf.miscEvents.map((m) => m.date),
    ...pf.dividendEvents.map((d) => d.date),
  ].sort();
  const period = resolvePeriod(query, today);
  const options = fyOptions(allDates[0] ?? null, today).map((fy, i) => ({
    value: `fy:${fy}`,
    label: i === 0 ? `FY ${fy} (current)` : `FY ${fy}`,
  }));
  if (period.value.startsWith("fy:") && !options.some((o) => o.value === period.value)) {
    options.push({ value: period.value, label: period.label });
  }

  // Category and platform filters apply to the mix, the realised trio and the chart.
  const assetMap = new Map(pf.assets.map((a) => [a.id, a]));
  const categoryOptions = [...new Set(pf.assets.map((a) => ASSET_RULES[a.type].category))].sort();
  const filters = readFilters(query, ["ty", "pf"], { ty: categoryOptions, pf: pf.platforms });
  const fq = filterQs(filters);

  const salePlatforms = new Map(pf.saleEvents.map((s) => [s.id, s.platforms]));
  const rowsInFilter = pf.rows.filter(
    (r) =>
      passes(filters.ty, ASSET_RULES[r.assetType].category) &&
      passes(filters.pf, r.kind === "sale" ? salePlatforms.get(r.id) : "–"),
  );
  const periodRows = rowsInFilter.filter((r) => inPeriod(r.date, period));
  const t = totals(periodRows);
  const years = byFinancialYear(rowsInFilter);

  const mix = computeMix(pf.lots, pf.sold, assetMap, { category: filters.ty, platform: filters.pf });
  const view: MixView = MIX_VIEWS.includes(query.mix as MixView) ? (query.mix as MixView) : "Platform";
  const mixRows = rowsFor(mix, view);
  const colorOf = new Map(mixRows.map((r, i) => [r.key, MIX_COLORS[i % MIX_COLORS.length]]));

  const top = mix.byHolding.slice(0, 5).map((h) => ({ ...h, asset: assetMap.get(h.id)! }));
  const upcoming = upcomingMaturities(pf.assets, new Set(mix.holdingIds), today);

  const periodText =
    period.value === "custom" && period.from && period.to
      ? `${formatDate(period.from)} to ${formatDate(period.to)}`
      : period.label;

  // Keep the period and filters when switching the mix view.
  const mixHref = (m: MixView) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) if (k !== "mix" && typeof v === "string" && v) qs.set(k, v);
    qs.set("mix", m);
    return `/dashboard?${qs.toString()}`;
  };
  // A slice opens Holdings already filtered (exposure has no Holdings filter yet).
  const sliceHref = (key: string) =>
    view === "Platform" ? `/holdings?pf=${encodeURIComponent(key)}` : view === "Category" ? `/holdings?ty=${encodeURIComponent(key)}` : null;

  const empty = pf.lots.length === 0 && pf.miscEvents.length === 0 && pf.dividendEvents.length === 0;

  return (
    <div>
      <h1 className="sr-only">Dashboard</h1>

      <div className="sticky top-[57px] z-20 -mx-4 mb-4 flex flex-wrap items-start gap-3 bg-bg px-4 py-2 sm:-mx-6 sm:px-6 lg:top-0 lg:-mx-10 lg:px-10">
        <PeriodFilter
          options={options}
          value={period.value}
          from={period.from ?? ""}
          to={period.to ?? ""}
          earliest={allDates[0] ?? today}
          today={today}
          extraQuery={[fq, query.mix ? `mix=${encodeURIComponent(query.mix)}` : ""].filter(Boolean).join("&")}
        />
        <div className="min-w-0 flex-1">
          <FilterBar
            basePath="/dashboard"
            selected={filters}
            groups={[
              { id: "ty", label: "Category", options: categoryOptions.length > 1 ? categoryOptions : [] },
              { id: "pf", label: "Platform", options: pf.platforms },
            ]}
          />
        </div>
        <HideAmountsButton />
      </div>

      {empty ? (
        <SectionCard>
          <EmptyState
            icon={Coins}
            title="No investments yet"
            text="Add your first investment to see your mix and what you realised."
            action={
              <Link href="/holdings?add=1" className="btn-primary">
                Add investment
              </Link>
            }
          />
        </SectionCard>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            <section className="card min-w-0">
              <p className="t-label">Total invested · by cost</p>
              <p className="t-hero mt-1.5">
                <Amount>{formatINRWhole(mix.total)}</Amount>
              </p>
              <p className="t-caption mt-1.5">
                {mix.holdingIds.length} holding{mix.holdingIds.length === 1 ? "" : "s"} · as of today
              </p>
              <div className="mt-4">
                <SegmentLinks
                  label="Mix view"
                  items={MIX_VIEWS.map((m) => ({ href: mixHref(m), label: m, active: m === view }))}
                />
              </div>
              {mixRows.length === 0 ? (
                <p className="t-body py-6 text-center text-muted">Nothing held with these filters.</p>
              ) : (
                <div className="flex flex-wrap items-center gap-4">
                  <MixDonut
                    label={view.toLowerCase()}
                    data={mixRows.map((r) => ({ name: r.key, value: r.cost, color: colorOf.get(r.key)! }))}
                  />
                  <ul className="grid min-w-40 flex-1 gap-1">
                    {mixRows.map((r) => {
                      const href = sliceHref(r.key);
                      const body = (
                        <>
                          <span className="flex min-w-0 items-center gap-2">
                            <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: colorOf.get(r.key) }} aria-hidden />
                            <span className="t-body truncate">{r.key}</span>
                          </span>
                          <span className="t-caption num shrink-0">
                            {formatPercent(r.share)} · <Amount>{formatINRCompact(r.cost)}</Amount>
                          </span>
                        </>
                      );
                      return (
                        <li key={r.key}>
                          {href ? (
                            <Link href={href} className="-mx-1.5 flex items-center justify-between gap-2 rounded-md px-1.5 py-1 outline-none hover:bg-surface2 focus-visible:bg-surface2">
                              {body}
                            </Link>
                          ) : (
                            <div className="flex items-center justify-between gap-2 py-1">{body}</div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </section>

            <div className="min-w-0 space-y-4 lg:col-span-2">
              <div className="grid grid-cols-3 gap-2 sm:gap-4">
                <TrioCard
                  short="Gain"
                  long="Realised gain"
                  value={t.gain}
                  signed
                  hint={periodText}
                  valueClass={gainClass(t.gain)}
                />
                <TrioCard short="Tax" long="Estimated tax" value={t.tax} hint={periodText} />
                <TrioCard
                  short="Post-tax"
                  long="Post-tax gain"
                  value={t.net}
                  signed
                  hint={periodText}
                  valueClass={gainClass(t.net)}
                  hero
                />
              </div>

              <SectionCard title="Post-tax gain by financial year" description="Green is profit, red is loss. Estimated tax included.">
                {years.length ? (
                  <GainByYearChart data={years} />
                ) : (
                  <p className="py-10 text-center text-sm text-muted">No realised gains yet.</p>
                )}
              </SectionCard>
            </div>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <SectionCard
              title="Top holdings"
              description="By what you paid."
              flush
            >
              {top.length === 0 ? (
                <p className="px-5 py-6 text-sm text-muted">Nothing held with these filters.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {top.map((h) => (
                    <li key={h.id}>
                      <Link
                        href={`/holdings/${h.id}`}
                        className="flex items-center justify-between gap-3 px-5 py-3 outline-none hover:bg-surface2 focus-visible:bg-surface2"
                      >
                        <span className="min-w-0">
                          <span className="t-body-strong block truncate">{h.asset.name}</span>
                          <span className="t-caption block">{ASSET_RULES[h.asset.type].category}</span>
                        </span>
                        <span className="shrink-0 text-right">
                          <span className="t-body-strong block">
                            <Amount>{formatINRWhole(h.cost)}</Amount>
                          </span>
                          <span className="t-caption num block">{formatPercent(mix.total > 0 ? (h.cost / mix.total) * 100 : 0)}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              <div className="border-t border-line px-5 py-3">
                <Link href="/holdings" className="text-sm font-medium text-primary hover:underline">
                  View all holdings
                </Link>
              </div>
            </SectionCard>

            {upcoming.length > 0 && (
              <SectionCard title="Upcoming" description="Maturities in the next 90 days." flush>
                <ul className="divide-y divide-line">
                  {upcoming.map((m) => (
                    <li key={m.id}>
                      <Link
                        href={`/holdings/${m.id}`}
                        className="flex items-center justify-between gap-3 px-5 py-3 outline-none hover:bg-surface2 focus-visible:bg-surface2"
                      >
                        <span className="min-w-0">
                          <span className="t-body-strong block truncate">{m.name}</span>
                          <span className="t-caption block">Matures {formatDate(m.date)}</span>
                        </span>
                        <span className="badge-muted shrink-0">
                          {m.daysLeft === 0 ? "today" : `in ${m.daysLeft} day${m.daysLeft === 1 ? "" : "s"}`}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </SectionCard>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/** One of the three realised cards. Each says which period it covers; labels shorten on a very narrow phone. */
function TrioCard({
  short,
  long,
  value,
  hint,
  signed = false,
  hero = false,
  valueClass = "",
}: {
  short: string;
  long: string;
  value: number;
  hint: string;
  signed?: boolean;
  hero?: boolean;
  valueClass?: string;
}) {
  return (
    <div className={`min-w-0 rounded-xl border p-3 sm:p-4 ${hero ? "border-primary/40 bg-primary-soft" : "border-line bg-surface"}`}>
      <p className="t-label">
        <span className="min-[420px]:hidden">{short}</span>
        <span className="hidden min-[420px]:inline">{long}</span>
      </p>
      <p className={`t-kpi mt-1.5 ${valueClass}`}>
        <ResponsiveAmount
          whole={formatINRWhole(value, { sign: signed })}
          compact={formatINRCompact(value, { sign: signed })}
        />
      </p>
      <p className="t-caption mt-1.5 [overflow-wrap:anywhere]">{hint}</p>
    </div>
  );
}
