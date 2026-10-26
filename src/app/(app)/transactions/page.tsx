import { ArrowLeftRight, Pencil } from "lucide-react";
import Link from "next/link";
import { ListSearch } from "@/components/ListSearch";
import { SortHeader } from "@/components/SortHeader";
import { EmptyState, PageHeader, SectionCard } from "@/components/ui";
import { todayIso } from "@/domain/dates";
import { platformOf } from "@/domain/platform";
import { fyOptions, inPeriod, resolvePeriod } from "@/domain/period";
import { ASSET_RULES, type AssetTypeId } from "@/domain/taxRules";
import { requireUser } from "@/features/auth/session";
import { PeriodFilter } from "@/features/dashboard/PeriodFilter";
import { loadPortfolio } from "@/features/portfolio/data";
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
  platform: string;
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

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string; q?: string; sort?: string; dir?: string }>;
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
        platform: platformOf(l.source),
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
        platform: platformOf(s.source),
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

  const q = (query.q ?? "").trim();
  const needle = q.toLowerCase();
  const shown = txns.filter(
    (t) =>
      inPeriod(t.date, period) &&
      (!needle ||
        [t.name, t.typeLabel, t.platform, badge[t.kind].label, t.note ?? ""].some((s) => s.toLowerCase().includes(needle))),
  );
  const filtered = shown.length !== txns.length;

  const sort = parseSort(query, SORT_KEYS, { key: "date", dir: "desc" });
  const sortQuery = `sort=${sort.key}&dir=${sort.dir}`;
  const withQ = q ? `&q=${encodeURIComponent(q)}` : "";
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
  const head = (label: string, col: (typeof SORT_KEYS)[number], align: "left" | "right" = "left", firstDir: "asc" | "desc" = "asc") => (
    <SortHeader label={label} col={col} sort={sort} basePath="/transactions" query={`${periodQuery}${withQ}`} align={align} firstDir={firstDir} />
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
          query={`${periodQuery}&${sortQuery}`}
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
          extraQuery={`${sortQuery}${withQ}`}
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
            text="Try a different period or clear the search."
          />
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                {head("Date", "date", "left", "desc")}
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
                  <td className="td text-muted">{t.platform}</td>
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
                        aria-label="Edit"
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
