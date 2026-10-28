import { ArrowLeftRight, ChevronRight, Pencil } from "lucide-react";
import Link from "next/link";
import { Amount } from "@/components/Amount";
import { FilterBar } from "@/components/FilterBar";
import { ListSearch } from "@/components/ListSearch";
import { SortHeader } from "@/components/SortHeader";
import { EmptyState, PageHeader, SectionCard } from "@/components/ui";
import { todayIso } from "@/domain/dates";
import { fyOptions, inPeriod, resolvePeriod } from "@/domain/period";
import { requireUser } from "@/features/auth/session";
import { buildFeed, groupByMonth, KIND_BADGE, KIND_LABEL, type FeedItem } from "@/features/activity/feed";
import { PeriodFilter } from "@/features/dashboard/PeriodFilter";
import { loadPortfolio } from "@/features/portfolio/data";
import { filterQs, passes, readFilters } from "@/lib/filters";
import { formatDate, formatDayMonth, formatINR, formatINRWhole, formatPrice, formatQty, gainClass, MINUS } from "@/lib/format";
import { parseSort, sortRows } from "@/lib/sort";

const SORT_KEYS = ["date", "action", "asset", "platform", "qty", "price", "fees", "amount"] as const;

export const metadata = { title: "Activity" };

/** Where tapping an entry goes: its edit page, or the place it is managed. */
function hrefFor(t: FeedItem): string {
  if (t.kind === "misc") return "/gains/misc";
  if (!t.assetId) return "/holdings";
  if (t.kind === "buy") return `/holdings/${t.assetId}/lots/${t.id}`;
  if (t.kind === "sell" || t.kind === "buyback") return `/holdings/${t.assetId}/sales/${t.id}`;
  return `/holdings/${t.assetId}?tab=events`;
}

const signedWhole = (n: number) => (n > 0 ? `+${formatINRWhole(n)}` : n < 0 ? `${MINUS}${formatINRWhole(Math.abs(n))}` : formatINRWhole(0));

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string; q?: string; sort?: string; dir?: string; act?: string; ty?: string; pf?: string }>;
}) {
  const query = await searchParams;
  const user = await requireUser();
  const pf = await loadPortfolio(user.id);

  const txns = buildFeed({
    assets: pf.assets,
    lots: pf.lots,
    sales: pf.saleEvents,
    misc: pf.miscEvents,
    actions: pf.actions,
  });

  const today = todayIso();
  const earliest = txns.length ? txns[txns.length - 1].date : today;
  const period = resolvePeriod(query, today);
  const options = fyOptions(txns.length ? earliest : null, today).map((fy, i) => ({
    value: `fy:${fy}`,
    label: i === 0 ? `FY ${fy} (current)` : `FY ${fy}`,
  }));
  if (period.value.startsWith("fy:") && !options.some((o) => o.value === period.value)) {
    options.push({ value: period.value, label: period.label });
  }
  const periodQuery =
    period.value === "custom"
      ? `period=custom&from=${period.from}&to=${period.to}`
      : `period=${encodeURIComponent(period.value)}`;

  const categoryOptions = [...new Set(txns.map((t) => t.category).filter(Boolean))].sort();
  const filters = readFilters(query, ["act", "ty", "pf"], {
    act: Object.values(KIND_LABEL),
    ty: categoryOptions,
    pf: pf.platforms,
  });
  const fq = filterQs(filters);
  const q = (query.q ?? "").trim();
  const needle = q.toLowerCase();
  const shown = txns.filter(
    (t) =>
      inPeriod(t.date, period) &&
      passes(filters.act, KIND_LABEL[t.kind]) &&
      passes(filters.ty, t.category) &&
      passes(filters.pf, t.platform.split(", ")) &&
      (!needle ||
        [t.name, t.typeLabel, t.platform, KIND_LABEL[t.kind], t.note ?? "", t.detail ?? ""].some((s) => s.toLowerCase().includes(needle))),
  );
  const filtered = shown.length !== txns.length;
  const months = groupByMonth(shown);

  const sort = parseSort(query, SORT_KEYS, { key: "date", dir: "desc" });
  const sortQuery = `sort=${sort.key}&dir=${sort.dir}`;
  const withQ = q ? `&q=${encodeURIComponent(q)}` : "";
  const withF = fq ? `&${fq}` : "";
  const getters: Record<(typeof SORT_KEYS)[number], (t: FeedItem) => string | number> = {
    date: (t) => t.date,
    action: (t) => KIND_LABEL[t.kind],
    asset: (t) => t.name,
    platform: (t) => t.platform,
    qty: (t) => t.qty ?? Number.NEGATIVE_INFINITY,
    price: (t) => t.price ?? Number.NEGATIVE_INFINITY,
    fees: (t) => t.fees,
    amount: (t) => t.amount,
  };
  const rows = sortRows(shown, getters[sort.key], sort.dir);
  const head = (label: string, col: (typeof SORT_KEYS)[number], align: "left" | "right" = "left", firstDir: "asc" | "desc" = "asc", className = "") => (
    <SortHeader label={label} col={col} sort={sort} basePath="/transactions" query={`${periodQuery}${withQ}${withF}`} align={align} firstDir={firstDir} className={className} />
  );
  const priceText = (t: FeedItem) => (t.price === null ? "–" : formatPrice(t.price, { crypto: t.typeLabel === "Crypto" }));

  return (
    <div>
      <PageHeader
        title="Activity"
        description="Every purchase, sale, dividend and event, newest first. Open an entry to edit it."
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <ListSearch
          q={q}
          basePath="/transactions"
          query={`${periodQuery}&${sortQuery}${withF}`}
          placeholder="Search name, type, platform or note"
        />
        <PeriodFilter
          options={options}
          value={period.value}
          from={period.from ?? ""}
          to={period.to ?? ""}
          earliest={earliest}
          today={today}
          basePath="/transactions"
          extraQuery={`${sortQuery}${withQ}${withF}`}
        />
        <div className="min-w-0 flex-1">
          <FilterBar
            basePath="/transactions"
            selected={filters}
            groups={[
              { id: "act", label: "Action", options: Object.values(KIND_LABEL) },
              { id: "ty", label: "Category", options: categoryOptions.length > 1 ? categoryOptions : [] },
              { id: "pf", label: "Platform", options: pf.platforms },
            ]}
          />
        </div>
      </div>
      {txns.length > 0 && (
        <p className="t-caption mb-3">
          {shown.length} entr{shown.length === 1 ? "y" : "ies"}
          {filtered ? ` of ${txns.length}` : ""}
        </p>
      )}

      {txns.length === 0 ? (
        <SectionCard flush>
          <EmptyState icon={ArrowLeftRight} title="No activity yet" text="Add an investment to get started." />
        </SectionCard>
      ) : shown.length === 0 ? (
        <SectionCard flush>
          <EmptyState icon={ArrowLeftRight} title="Nothing matches" text="Try a different period or clear the search and filters." />
        </SectionCard>
      ) : (
        <>
          {/* Phones and tablets: a feed grouped by month. */}
          <div className="space-y-5 lg:hidden">
            {months.map((m) => (
              <section key={m.key} aria-label={m.label} className="card !p-0 overflow-hidden">
                <div className="flex items-baseline justify-between gap-3 border-b border-line bg-surface2 px-4 py-3">
                  <h2 className="t-title">{m.label}</h2>
                  <p className="t-caption num">
                    {m.count} entr{m.count === 1 ? "y" : "ies"} · net cash{" "}
                    <span className={`font-medium ${gainClass(m.net)}`}>
                      <Amount>{signedWhole(m.net)}</Amount>
                    </span>
                  </p>
                </div>
                <ul className="divide-y divide-line">
                  {m.items.map((t) => (
                    <li key={t.key}>
                      <Link
                        href={hrefFor(t)}
                        aria-label={`Open ${KIND_LABEL[t.kind]} of ${t.name} on ${formatDate(t.date)}`}
                        className="flex items-center gap-3 px-4 py-3 outline-none hover:bg-surface2 focus-visible:bg-surface2"
                      >
                        <div className="t-caption w-14 shrink-0">{formatDayMonth(t.date)}</div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className={`${KIND_BADGE[t.kind]} shrink-0`}>{KIND_LABEL[t.kind]}</span>
                            <span className="t-body-strong truncate">{t.name}</span>
                          </div>
                          <div className="t-caption num mt-0.5 truncate">
                            {t.detail ??
                              (t.qty === null
                                ? t.note || t.typeLabel
                                : `${formatQty(t.qty)} × ${priceText(t)}${t.platform !== "–" ? ` · ${t.platform}` : ""}${t.fees ? ` · fees ${formatINR(t.fees)}` : ""}`)}
                          </div>
                        </div>
                        <div className={`t-body-strong num shrink-0 text-right ${t.kind === "misc" ? gainClass(t.amount) : ""}`}>
                          {t.kind === "event" ? "–" : <Amount>{formatINR(t.amount)}</Amount>}
                        </div>
                        <ChevronRight size={16} className="shrink-0 text-muted" aria-hidden />
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>

          {/* Desktop: the sortable table. */}
          <div className="hidden lg:block">
            <SectionCard flush>
              <table className="w-full">
                <thead>
                  <tr>
                    {head("Date", "date", "left", "desc", "sticky-col")}
                    {head("Action", "action")}
                    {head("Asset", "asset")}
                    {head("Platform", "platform")}
                    {head("Qty", "qty", "right", "desc")}
                    {head("Price", "price", "right", "desc")}
                    {head("Fees", "fees", "right", "desc")}
                    {head("Amount", "amount", "right", "desc")}
                    <th className="th" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((t) => (
                    <tr key={t.key}>
                      <td className="td sticky-col">{formatDate(t.date)}</td>
                      <td className="td">
                        <span className={KIND_BADGE[t.kind]}>{KIND_LABEL[t.kind]}</span>
                        {t.detail && <span className="t-caption ml-2">{t.detail}</span>}
                      </td>
                      <td className="td">
                        {t.assetId ? (
                          <Link href={`/holdings/${t.assetId}`} className="font-medium hover:text-primary hover:underline">
                            {t.name}
                          </Link>
                        ) : (
                          <span className="font-medium">{t.name}</span>
                        )}
                        <span className="t-caption ml-2">{t.typeLabel}</span>
                      </td>
                      <td className="td text-muted">{t.platform}</td>
                      <td className="td num text-right">{t.qty === null ? "–" : formatQty(t.qty)}</td>
                      <td className="td num text-right">
                        <Amount>{priceText(t)}</Amount>
                      </td>
                      <td className="td num text-right">{t.fees ? <Amount>{formatINR(t.fees)}</Amount> : "–"}</td>
                      <td className={`td text-right font-medium ${t.kind === "misc" ? gainClass(t.amount) : ""}`}>
                        {t.kind === "event" ? "–" : <Amount>{formatINR(t.amount)}</Amount>}
                      </td>
                      <td className="td text-right">
                        <Link
                          href={hrefFor(t)}
                          aria-label={`Open ${KIND_LABEL[t.kind]} of ${t.name} on ${formatDate(t.date)}`}
                          className="btn-ghost !h-8 !px-2.5"
                        >
                          <Pencil size={14} />
                          <span>{t.kind === "buy" || t.kind === "sell" || t.kind === "buyback" ? "Edit" : "Open"}</span>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </SectionCard>
          </div>
        </>
      )}
    </div>
  );
}
