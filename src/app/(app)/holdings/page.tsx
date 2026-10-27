import { BriefcaseBusiness, RefreshCw, Upload } from "lucide-react";
import Link from "next/link";
import { ListSearch } from "@/components/ListSearch";
import { SortHeader } from "@/components/SortHeader";
import { EmptyState, SectionCard } from "@/components/ui";
import { todayIso } from "@/domain/dates";
import { lotUnitCost } from "@/domain/fifo";
import { fyOptions, inPeriod, resolvePeriod } from "@/domain/period";
import { platformOf } from "@/domain/platform";
import { ASSET_RULES } from "@/domain/taxRules";
import { requireUser } from "@/features/auth/session";
import { PeriodFilter } from "@/features/dashboard/PeriodFilter";
import { AddInvestment } from "@/features/holdings/AddInvestment";
import { HoldingsTable } from "@/features/holdings/HoldingsTable";
import { loadPortfolio } from "@/features/portfolio/data";
import { formatINR, formatQty } from "@/lib/format";
import { parseSort, sortRows } from "@/lib/sort";

const SORT_KEYS = ["name", "type", "platform", "qty", "avg", "invested"] as const;

interface Row {
  id: string;
  name: string;
  typeLabel: string;
  platform: string;
  qty: number;
  cost: number;
  avgCost: number;
}

export const metadata = { title: "Holdings" };

export default async function HoldingsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string; q?: string; sort?: string; dir?: string }>;
}) {
  const query = await searchParams;
  const user = await requireUser();
  const pf = await loadPortfolio(user.id);
  const today = todayIso();

  const earliest = pf.lots.map((l) => l.buyDate).sort()[0] ?? today;
  const period = resolvePeriod({ ...query, period: query.period ?? "all" }, today);
  const options = fyOptions(pf.lots.length ? earliest : null, today).map((fy, i) => ({
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

  const q = (query.q ?? "").trim();
  const needle = q.toLowerCase();
  const sort = parseSort(query, SORT_KEYS, { key: "invested", dir: "desc" });
  const sortQuery = `sort=${sort.key}&dir=${sort.dir}`;
  const withQ = q ? `&q=${encodeURIComponent(q)}` : "";

  const assetMap = new Map(pf.assets.map((a) => [a.id, a]));
  const acc = new Map<string, Row & { platforms: Set<string> }>();
  for (const l of pf.lots) {
    const rem = l.qty - (pf.sold.get(l.id) ?? 0);
    const a = assetMap.get(l.assetId);
    if (rem <= 1e-9 || !a || !inPeriod(l.buyDate, period)) continue;
    const r = acc.get(a.id) ?? {
      id: a.id,
      name: a.name,
      typeLabel: ASSET_RULES[a.type].label,
      platform: "",
      platforms: new Set<string>(),
      qty: 0,
      cost: 0,
      avgCost: 0,
    };
    r.qty += rem;
    r.cost += rem * lotUnitCost(l);
    r.platforms.add(platformOf(l.source));
    acc.set(a.id, r);
  }
  const all: Row[] = [...acc.values()].map((r) => ({
    ...r,
    platform: [...r.platforms].sort().join(", ") || "–",
    avgCost: r.qty > 0 ? r.cost / r.qty : 0,
  }));
  const matches = (parts: string[]) => !needle || parts.some((s) => s.toLowerCase().includes(needle));
  const filtered = all.filter((r) => matches([r.name, r.typeLabel, r.platform]));

  const getters: Record<(typeof SORT_KEYS)[number], (r: Row) => string | number> = {
    name: (r) => r.name,
    type: (r) => r.typeLabel,
    platform: (r) => r.platform,
    qty: (r) => r.qty,
    avg: (r) => r.avgCost,
    invested: (r) => r.cost,
  };
  const rows = sortRows(filtered, getters[sort.key], sort.dir);
  const totalCost = rows.reduce((s, r) => s + r.cost, 0);

  const heldIds = new Set(pf.holdings.map((h) => h.id));
  const closed = pf.assets.filter(
    (a) =>
      !heldIds.has(a.id) &&
      pf.lots.some((l) => l.assetId === a.id && inPeriod(l.buyDate, period)) &&
      matches([a.name, ASSET_RULES[a.type].label]),
  );

  const filterNote = period.value !== "all" || q;
  const baseQuery = `${periodQuery}${withQ}`;
  const head = (label: string, col: (typeof SORT_KEYS)[number], align: "left" | "right" = "left", firstDir: "asc" | "desc" = "asc", className = "") => (
    <SortHeader label={label} col={col} sort={sort} basePath="/holdings" query={baseQuery} align={align} firstDir={firstDir} className={className} />
  );

  return (
    <div>
      <AddInvestment
        today={today}
        title="Holdings"
        description={
          pf.holdings.length
            ? `${rows.length} holding${rows.length === 1 ? "" : "s"}${filterNote ? ` of ${pf.holdings.length}` : ""} · ${formatINR(totalCost)} invested${
                period.value !== "all" ? ` · units bought in ${period.value === "custom" ? "the selected dates" : period.label}` : ""
              }`
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
          query={`${periodQuery}&${sortQuery}`}
          placeholder="Search name, type or platform"
        />
        <PeriodFilter
          options={options}
          value={period.value}
          from={period.from ?? ""}
          to={period.to ?? ""}
          earliest={earliest}
          today={today}
          basePath="/holdings"
          extraQuery={`${sortQuery}${withQ}`}
        />
      </AddInvestment>

      <div className="space-y-5">
        <SectionCard title="Current holdings" flush>
          {pf.holdings.length === 0 ? (
            <EmptyState
              icon={BriefcaseBusiness}
              title="No holdings yet"
              text="Press Add investment to record your first one."
            />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={BriefcaseBusiness}
              title="No holdings match"
              text="Try a different period or clear the search."
            />
          ) : (
            <HoldingsTable
              head={
                <>
                  {head("Name", "name", "left", "asc", "sticky-col")}
                  {head("Type", "type", "left", "asc", "hidden md:table-cell")}
                  {head("Platform", "platform", "left", "asc", "hidden md:table-cell")}
                  {head("Quantity", "qty", "right", "desc")}
                  {head("Avg cost", "avg", "right", "desc")}
                  {head("Invested", "invested", "right", "desc")}
                </>
              }
              rows={rows.map((h) => ({
                id: h.id,
                name: h.name,
                typeLabel: h.typeLabel,
                platform: h.platform,
                qty: formatQty(h.qty),
                avgCost: formatINR(h.avgCost),
                cost: formatINR(h.cost),
              }))}
            />
          )}
        </SectionCard>

        {closed.length > 0 && (
          <SectionCard title="Fully sold" description="Past holdings you no longer own" flush>
            <ul className="divide-y divide-line">
              {closed.map((a) => (
                <li key={a.id}>
                  <Link href={`/holdings/${a.id}`} className="flex items-center justify-between px-5 py-3 hover:bg-surface2">
                    <span className="font-medium">{a.name}</span>
                    <span className="text-sm text-muted">{ASSET_RULES[a.type].label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </SectionCard>
        )}
      </div>
    </div>
  );
}
