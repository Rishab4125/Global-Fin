import { ArrowLeftRight, Pencil } from "lucide-react";
import Link from "next/link";
import { FilterBar } from "@/components/FilterBar";
import { ListSearch } from "@/components/ListSearch";
import { SortHeader } from "@/components/SortHeader";
import { EmptyState, PageHeader, SectionCard } from "@/components/ui";
import { todayIso } from "@/domain/dates";
import { fyOptions, inPeriod, resolvePeriod } from "@/domain/period";
import { ASSET_RULES, type AssetTypeId } from "@/domain/taxRules";
import { requireUser } from "@/features/auth/session";
import { PeriodFilter } from "@/features/dashboard/PeriodFilter";
import { loadPortfolio } from "@/features/portfolio/data";
import { filterQs, passes, readFilters } from "@/lib/filters";
import { formatDate, formatINR, formatQty, gainClass } from "@/lib/format";
import { parseSort, sortRows } from "@/lib/sort";

const SORT_KEYS = ["date", "action", "asset", "platform", "qty", "price", "fees", "amount"] as const;

type Kind = "buy" | "sell" | "misc" | "buyback";

interface Txn {
  key: string;
  id: string;
  kind: Kind;
  date: string;
  assetId?: string;
  name: string;
  typeLabel: string;
  group: string;
  platform: string;
  qty: number | null;
  price: number | null;
  fees: number;
  /** Signed amount: cost for buys, proceeds for sells, gain/loss for misc, proceeds for buybacks. */
  amount: number;
  note?: string;
}

const badge: Record<Kind, { label: string; className: string }> = {
  buy: { label: "Buy", className: "badge-gain" },
  sell: { label: "Sell", className: "badge-warn" },
  misc: { label: "Misc P/L", className: "badge-muted" },
  buyback: { label: "Buyback", className: "badge-warn" },
};

export const metadata = { title: "Transactions" };

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string; q?: string; sort?: string; dir?: string; act?: string; ty?: string; pf?: string }>;
}) {
  const query = await searchParams;
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
        group: a ? ASSET_RULES[a.type].category : "",
        platform: l.platform ?? "Other",
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
        kind: s.buyback ? "buyback" : "sell",
        date: s.date,
        assetId: s.assetId,
        name: a?.name ?? "Unknown",
        typeLabel: a ? typeLabel(a.type) : "",
        group: a ? ASSET_RULES[a.type].category : "",
        platform: s.platforms?.join(", ") || "Other",
        qty: s.qty,
        price: s.price,
        fees: s.fees,
        amount: s.qty * s.price,
      };
    }),
    ...pf.miscEvents.map((m): Txn => {
      return {
        key: `misc-${m.id}`,
        id: m.id,
        kind: "misc",
        date: m.date,
        name: "Misc profit / loss",
        typeLabel: typeLabel(m.assetType),
        group: ASSET_RULES[m.assetType].category,
        platform: "–",
        qty: null,
        price: null,
        fees: m.brokerage,
        amount: m.amount,
        note: m.note,
      };
    }),
  ].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  const today = todayIso();
  const earliest = txns.length ? txns[txns.length - 1].date : today;
  const period = resolvePeriod({ ...query, period: query.period ?? "all" }, today);
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

  const groupOptions = [...new Set(txns.map((t) => t.group).filter(Boolean))].sort();
  const filters = readFilters(query, ["act", "ty", "pf"], {
    act: Object.values(badge).map((b) => b.label),
    ty: groupOptions,
    pf: pf.platforms,
  });
  const fq = filterQs(filters);
  const q = (query.q ?? "").trim();
  const needle = q.toLowerCase();
  const shown = txns.filter(
    (t) =>
      inPeriod(t.date, period) &&
      passes(filters.act, badge[t.kind].label) &&
      passes(filters.ty, t.group) &&
      passes(filters.pf, t.platform.split(", ")) &&
      (!needle ||
        [t.name, t.typeLabel, t.platform, badge[t.kind].label, t.note ?? ""].some((s) => s.toLowerCase().includes(needle))),
  );
  const filtered = shown.length !== txns.length;

  const sort = parseSort(query, SORT_KEYS, { key: "date", dir: "desc" });
  const sortQuery = `sort=${sort.key}&dir=${sort.dir}`;
  const withQ = q ? `&q=${encodeURIComponent(q)}` : "";
  const withF = fq ? `&${fq}` : "";
  const getters: Record<(typeof SORT_KEYS)[number], (t: Txn) => string | number> = {
    date: (t) => t.date,
    action: (t) => badge[t.kind].label,
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

  return (
    <div>
      <PageHeader
        title="Transactions"
        description="Every purchase, sale and misc entry. Open a holding to edit or delete its entries."
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
        <FilterBar
          basePath="/transactions"
          selected={filters}
          groups={[
            { id: "act", label: "Action", options: Object.values(badge).map((b) => b.label) },
            { id: "ty", label: "Category", options: groupOptions.length > 1 ? groupOptions : [] },
            { id: "pf", label: "Platform", options: pf.platforms },
          ]}
        />
      </div>
      {txns.length > 0 && (
        <p className="mb-3 text-sm text-muted">
          {shown.length} transaction{shown.length === 1 ? "" : "s"}
          {filtered ? ` of ${txns.length}` : ""}
        </p>
      )}
      <SectionCard flush>
        {txns.length === 0 ? (
          <EmptyState icon={ArrowLeftRight} title="No transactions yet" text="Add an investment to get started." />
        ) : shown.length === 0 ? (
          <EmptyState
            icon={ArrowLeftRight}
            title="No transactions match"
            text="Try a different period or clear the search and filters."
          />
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                {head("Date", "date", "left", "desc", "sticky-col")}
                {head("Action", "action")}
                {head("Asset", "asset")}
                {head("Platform", "platform", "left", "asc", "hidden md:table-cell")}
                {head("Qty", "qty", "right", "desc")}
                {head("Price", "price", "right", "desc")}
                {head("Fees", "fees", "right", "desc", "hidden md:table-cell")}
                {head("Amount", "amount", "right", "desc")}
                <th className="th" />
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.key}>
                  <td className="td sticky-col">{formatDate(t.date)}</td>
                  <td className="td">
                    <span className={badge[t.kind].className}>{badge[t.kind].label}</span>
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
                  <td className="td hidden text-muted md:table-cell">{t.platform}</td>
                  <td className="td text-right">{t.qty === null ? "–" : formatQty(t.qty)}</td>
                  <td className="td text-right">{t.price === null ? "–" : formatINR(t.price)}</td>
                  <td className="td hidden text-right md:table-cell">{t.fees ? formatINR(t.fees) : "–"}</td>
                  <td className={`td text-right font-medium ${t.kind === "misc" ? gainClass(t.amount) : ""}`}>
                    {formatINR(t.amount)}
                  </td>
                  <td className="td text-right">
                    {t.assetId ? (
                      <Link
                        href={`/holdings/${t.assetId}/${t.kind === "buy" ? "lots" : "sales"}/${t.id}`}
                        aria-label={`Edit ${t.kind === "buy" ? "purchase" : "sale"} of ${t.name} on ${formatDate(t.date)}`}
                        title="Edit"
                        className="btn-ghost !h-8 !px-2.5"
                      >
                        <Pencil size={14} />
                        <span className="hidden sm:inline">Edit</span>
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
