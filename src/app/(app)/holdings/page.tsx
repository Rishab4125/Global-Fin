import { BriefcaseBusiness, RefreshCw, Upload } from "lucide-react";
import Link from "next/link";
import { FilterBar } from "@/components/FilterBar";
import { ListSearch } from "@/components/ListSearch";
import { SortSelect } from "@/components/SortSelect";
import { EmptyState, Kpi, SectionCard } from "@/components/ui";
import { todayIso } from "@/domain/dates";
import { lotUnitCost } from "@/domain/fifo";
import { platformOf } from "@/domain/platform";
import { ASSET_RULES } from "@/domain/taxRules";
import { requireUser } from "@/features/auth/session";
import { AddInvestment } from "@/features/holdings/AddInvestment";
import { HoldingsGrid } from "@/features/holdings/HoldingsGrid";
import { loadPortfolio } from "@/features/portfolio/data";
import { filterQs, joinQs, passes, PLATFORMS, readFilters } from "@/lib/filters";
import { formatDate, formatINR, formatQty } from "@/lib/format";
import { parseSort, sortRows } from "@/lib/sort";

const SORT_KEYS = ["invested", "name", "qty", "avg", "recent"] as const;
const SORT_OPTIONS = [
  { value: "invested:desc", label: "Invested: high to low" },
  { value: "invested:asc", label: "Invested: low to high" },
  { value: "name:asc", label: "Name: A to Z" },
  { value: "qty:desc", label: "Quantity: high to low" },
  { value: "avg:desc", label: "Avg cost: high to low" },
  { value: "recent:desc", label: "Recently bought" },
];

interface Row {
  id: string;
  name: string;
  typeLabel: string;
  platforms: string[];
  qty: number;
  cost: number;
  avgCost: number;
  since: string;
  lastBuy: string;
}

export const metadata = { title: "Holdings" };

export default async function HoldingsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string; dir?: string; pf?: string; ty?: string }>;
}) {
  const query = await searchParams;
  const user = await requireUser();
  const pf = await loadPortfolio(user.id);
  const today = todayIso();

  const q = (query.q ?? "").trim();
  const needle = q.toLowerCase();
  const sort = parseSort(query, SORT_KEYS, { key: "invested", dir: "desc" });
  const groupOptions = [...new Set(pf.holdings.map((h) => ASSET_RULES[h.type].group))].sort();
  const filters = readFilters(query, ["pf", "ty"], { pf: PLATFORMS, ty: groupOptions });
  const fq = filterQs(filters);
  const withQ = joinQs(q ? `q=${encodeURIComponent(q)}` : "", fq);

  const assetMap = new Map(pf.assets.map((a) => [a.id, a]));
  const acc = new Map<string, Row & { platformSet: Set<string> }>();
  const byPlatform = new Map<string, number>();
  for (const l of pf.lots) {
    const rem = l.qty - (pf.sold.get(l.id) ?? 0);
    const a = assetMap.get(l.assetId);
    if (rem <= 1e-9 || !a) continue;
    if (!passes(filters.pf, platformOf(l.source)) || !passes(filters.ty, ASSET_RULES[a.type].group)) continue;
    const r = acc.get(a.id) ?? {
      id: a.id,
      name: a.name,
      typeLabel: ASSET_RULES[a.type].label,
      platforms: [],
      platformSet: new Set<string>(),
      qty: 0,
      cost: 0,
      avgCost: 0,
      since: l.buyDate,
      lastBuy: l.buyDate,
    };
    const part = rem * lotUnitCost(l);
    const platform = platformOf(l.source);
    r.qty += rem;
    r.cost += part;
    r.platformSet.add(platform);
    r.since = l.buyDate < r.since ? l.buyDate : r.since;
    r.lastBuy = l.buyDate > r.lastBuy ? l.buyDate : r.lastBuy;
    byPlatform.set(platform, (byPlatform.get(platform) ?? 0) + part);
    acc.set(a.id, r);
  }
  const all: Row[] = [...acc.values()].map(({ platformSet, ...r }) => ({
    ...r,
    platforms: [...platformSet].sort(),
    avgCost: r.qty > 0 ? r.cost / r.qty : 0,
  }));
  const filtered = all.filter(
    (r) => !needle || [r.name, r.typeLabel, ...r.platforms].some((s) => s.toLowerCase().includes(needle)),
  );

  const getters: Record<(typeof SORT_KEYS)[number], (r: Row) => string | number> = {
    name: (r) => r.name,
    qty: (r) => r.qty,
    avg: (r) => r.avgCost,
    invested: (r) => r.cost,
    recent: (r) => r.lastBuy,
  };
  const rows = sortRows(filtered, getters[sort.key], sort.dir);
  const totalCost = all.reduce((s, r) => s + r.cost, 0);
  const shownCost = rows.reduce((s, r) => s + r.cost, 0);
  const platformSplit = [...byPlatform.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([p, c]) => `${p} ${formatINR(c)}`)
    .join(" · ");

  return (
    <div>
      <AddInvestment
        today={today}
        title="Holdings"
        description={
          pf.holdings.length
            ? `${rows.length} holding${rows.length === 1 ? "" : "s"}${q || fq ? ` of ${all.length}` : ""} · ${formatINR(shownCost)} invested`
            : "Record what you own."
        }
        actions={
          <>
            <Link href="/holdings/import" aria-label="Import trades" title="Import trades" className="btn-ghost shrink-0 max-sm:!w-10 max-sm:!min-w-10 max-sm:!px-0">
              <Upload size={16} />
              <span className="hidden sm:inline">Import trades</span>
            </Link>
            <Link href="/holdings/sync" aria-label="Sync" title="Sync" className="btn-ghost shrink-0 max-sm:!w-10 max-sm:!min-w-10 max-sm:!px-0">
              <RefreshCw size={16} />
              <span className="hidden sm:inline">Sync</span>
            </Link>
          </>
        }
      >
        <ListSearch
          q={q}
          basePath="/holdings"
          query={joinQs(`sort=${sort.key}&dir=${sort.dir}`, fq)}
          placeholder="Search name, type or platform"
        />
        <SortSelect options={SORT_OPTIONS} value={`${sort.key}:${sort.dir}`} basePath="/holdings" query={withQ} />
        <FilterBar
          basePath="/holdings"
          selected={filters}
          groups={[
            { id: "pf", label: "Platform", options: PLATFORMS },
            { id: "ty", label: "Asset class", options: groupOptions.length > 1 ? groupOptions : [] },
          ]}
        />
      </AddInvestment>

      {all.length > 0 && (
        <div className="mb-5 grid grid-cols-2 gap-3 sm:gap-4">
          <Kpi label="Total invested" value={formatINR(totalCost)} icon={BriefcaseBusiness} hint={`${all.length} holding${all.length === 1 ? "" : "s"}`} />
          <Kpi label="By platform" value={String(byPlatform.size)} hint={platformSplit} />
        </div>
      )}

      <SectionCard flush>
        {pf.holdings.length === 0 ? (
          <EmptyState icon={BriefcaseBusiness} title="No holdings yet" text="Press Add investment to record your first one." />
        ) : rows.length === 0 ? (
          <EmptyState icon={BriefcaseBusiness} title="No holdings match" text="Clear the search or filters to see all your holdings." />
        ) : (
          <HoldingsGrid
            rows={rows.map((h) => ({
              id: h.id,
              name: h.name,
              typeLabel: h.typeLabel,
              platforms: h.platforms,
              qty: formatQty(h.qty),
              avgCost: formatINR(h.avgCost),
              cost: formatINR(h.cost),
              since: formatDate(h.since),
              share: totalCost > 0 ? `${((h.cost / totalCost) * 100).toFixed(1)}%` : "–",
            }))}
          />
        )}
      </SectionCard>
    </div>
  );
}
