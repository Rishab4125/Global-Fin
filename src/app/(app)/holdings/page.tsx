import { BriefcaseBusiness, RefreshCw, Upload } from "lucide-react";
import Link from "next/link";
import { Amount } from "@/components/Amount";
import { FilterBar } from "@/components/FilterBar";
import { HideAmountsButton } from "@/components/HideAmountsButton";
import { ListSearch } from "@/components/ListSearch";
import { ParamSelect } from "@/components/ParamSelect";
import { SegmentLinks } from "@/components/SegmentLinks";
import { SortSelect } from "@/components/SortSelect";
import { EmptyState, SectionCard } from "@/components/ui";
import { unitsNow } from "@/domain/corporateActions";
import { todayIso } from "@/domain/dates";
import { ASSET_RULES } from "@/domain/taxRules";
import { requireUser } from "@/features/auth/session";
import { AddInvestment } from "@/features/holdings/AddInvestment";
import { HoldingsGrid, type HoldingGroupData } from "@/features/holdings/HoldingsGrid";
import {
  buildHoldingRows,
  filterOptions,
  GROUP_OPTIONS,
  groupHoldingRows,
  searchRows,
  SORT_KEYS,
  sortHoldingRows,
  type GroupBy,
} from "@/features/holdings/list";
import { loadPortfolio } from "@/features/portfolio/data";
import { filterQs, joinQs, readFilters } from "@/lib/filters";
import { formatINRWhole, formatPercent, formatPrice, formatQty } from "@/lib/format";
import { parseSort } from "@/lib/sort";

const SORT_OPTIONS = [
  { value: "invested:desc", label: "Invested: high to low" },
  { value: "invested:asc", label: "Invested: low to high" },
  { value: "name:asc", label: "Name: A to Z" },
  { value: "qty:desc", label: "Quantity: high to low" },
  { value: "avg:desc", label: "Avg cost: high to low" },
  { value: "recent:desc", label: "Recently bought" },
];

export const metadata = { title: "Holdings" };

type Query = {
  q?: string;
  sort?: string;
  dir?: string;
  pf?: string;
  ty?: string;
  ex?: string;
  tag?: string;
  group?: string;
  view?: string;
  add?: string;
};

export default async function HoldingsPage({ searchParams }: { searchParams: Promise<Query> }) {
  const query = await searchParams;
  const user = await requireUser();
  const pf = await loadPortfolio(user.id);
  const today = todayIso();

  const q = (query.q ?? "").trim();
  const sort = parseSort(query, SORT_KEYS, { key: "invested", dir: "desc" });
  const groupBy: GroupBy = GROUP_OPTIONS.some((o) => o.value === query.group) ? (query.group as GroupBy) : "none";
  const table = query.view === "table";

  const listAssets = pf.assets.map((a) => ({ id: a.id, type: a.type, name: a.name, tags: a.tags }));
  const options = filterOptions(listAssets);
  const filters = readFilters(query, ["pf", "ty", "ex", "tag"], {
    pf: pf.platforms,
    ty: options.categories,
    ex: options.exposures,
    tag: options.tags,
  });
  const fq = filterQs(filters);

  const { rows: built, portfolioTotal } = buildHoldingRows(
    pf.lots,
    pf.sold,
    new Map(listAssets.map((a) => [a.id, a])),
    unitsNow(pf.actions, today),
    { platform: filters.pf, category: filters.ty, exposure: filters.ex, tag: filters.tag },
  );
  const rows = sortHoldingRows(searchRows(built, q), sort.key, sort.dir);
  const shownCost = rows.reduce((s, r) => s + r.cost, 0);
  const groups = groupHoldingRows(rows, groupBy);
  const share = (cost: number) => (portfolioTotal > 0 ? formatPercent((cost / portfolioTotal) * 100) : "–");

  const data: HoldingGroupData[] = groups.map((g) => ({
    title: g.key,
    subtotal: formatINRWhole(g.cost),
    share: share(g.cost),
    rows: g.rows.map((h) => ({
      id: h.id,
      name: h.name,
      category: ASSET_RULES[h.type].category,
      platforms: h.platforms,
      qty: formatQty(h.qty, h.type),
      avgCost: formatPrice(h.avgCost, { crypto: h.type === "crypto" }),
      cost: formatINRWhole(h.cost),
      share: share(h.cost),
      tags: h.tags,
    })),
  }));

  // Every control keeps the others' choices in the address.
  const qQs = q ? `q=${encodeURIComponent(q)}` : "";
  const groupQs = groupBy === "none" ? "" : `group=${groupBy}`;
  const viewQs = table ? "view=table" : "";
  const sortQs = `sort=${sort.key}&dir=${sort.dir}`;
  const viewHref = (view: "cards" | "table") =>
    `/holdings?${joinQs(qQs, fq, groupQs, sortQs, view === "table" ? "view=table" : "")}`;

  const hasAny = pf.holdings.length > 0;

  return (
    <div>
      <AddInvestment
        key={query.add ? "add" : "list"}
        defaultOpen={!!query.add}
        today={today}
        platforms={pf.platforms}
        defaultPlatform={pf.lastPlatform}
        title="Holdings"
        description={hasAny ? "What you hold, where, and what it cost." : "Record what you own."}
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
        {hasAny && (
          <>
            <ListSearch
              q={q}
              basePath="/holdings"
              query={joinQs(sortQs, fq, groupQs, viewQs)}
              placeholder="Search name, platform or tag"
            />
            <SortSelect options={SORT_OPTIONS} value={`${sort.key}:${sort.dir}`} basePath="/holdings" query={joinQs(qQs, fq, groupQs, viewQs)} />
            <ParamSelect param="group" label="Group holdings" value={groupBy} defaultValue="none" options={GROUP_OPTIONS} />
            <div className="hidden lg:block">
              <SegmentLinks
                label="Holdings layout"
                className=""
                items={[
                  { href: viewHref("cards"), label: "Cards", active: !table },
                  { href: viewHref("table"), label: "Table", active: table },
                ]}
              />
            </div>
            <FilterBar
              basePath="/holdings"
              selected={filters}
              groups={[
                { id: "ty", label: "Category", options: options.categories.length > 1 ? options.categories : [] },
                { id: "pf", label: "Platform", options: pf.platforms },
                { id: "ex", label: "Exposure", options: options.exposures.length > 1 ? options.exposures : [] },
                { id: "tag", label: "Tag", options: options.tags },
              ]}
            />
          </>
        )}
      </AddInvestment>

      {hasAny && (
        <div className="mb-4 flex flex-wrap items-end gap-x-8 gap-y-3">
          <div>
            <p className="t-label">Total invested · by cost</p>
            <p className="t-kpi mt-1">
              <Amount>{formatINRWhole(shownCost)}</Amount>
            </p>
          </div>
          <div>
            <p className="t-label">Holdings</p>
            <p className="t-kpi num mt-1">
              {rows.length}
              {rows.length !== pf.holdings.length && <span className="t-caption"> of {pf.holdings.length}</span>}
            </p>
          </div>
          <div className="ml-auto">
            <HideAmountsButton />
          </div>
        </div>
      )}

      <SectionCard flush>
        {!hasAny ? (
          <EmptyState icon={BriefcaseBusiness} title="No holdings yet" text="Press Add investment to record your first one." />
        ) : rows.length === 0 ? (
          <EmptyState icon={BriefcaseBusiness} title="No holdings match" text="Clear the search or filters to see all your holdings." />
        ) : (
          <HoldingsGrid groups={data} table={table} />
        )}
      </SectionCard>
      {hasAny && (
        <p className="t-caption mt-3">
          Amounts are what you paid. Current value and profit or loss appear once prices are added.
        </p>
      )}
    </div>
  );
}
