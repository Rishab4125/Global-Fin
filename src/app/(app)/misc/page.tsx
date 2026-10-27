import { Receipt } from "lucide-react";
import { DeleteButton } from "@/components/DeleteButton";
import { FilterBar } from "@/components/FilterBar";
import { ListSearch } from "@/components/ListSearch";
import { SortHeader } from "@/components/SortHeader";
import { EmptyState, SectionCard } from "@/components/ui";
import { todayIso } from "@/domain/dates";
import { fyOptions, inPeriod, resolvePeriod } from "@/domain/period";
import { ASSET_RULES } from "@/domain/taxRules";
import { requireUser } from "@/features/auth/session";
import { PeriodFilter } from "@/features/dashboard/PeriodFilter";
import { AddMisc } from "@/features/misc/AddMisc";
import { deleteMiscAction } from "@/features/misc/actions";
import { loadPortfolio } from "@/features/portfolio/data";
import { filterQs, passes, readFilters } from "@/lib/filters";
import { formatDate, formatINR, gainClass } from "@/lib/format";
import { parseSort, sortRows } from "@/lib/sort";

const SORT_KEYS = ["date", "type", "amount", "brokerage", "tax", "net", "note"] as const;

export const metadata = { title: "Misc profit / loss" };

export default async function MiscPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string; q?: string; sort?: string; dir?: string; ty?: string; sign?: string; adj?: string }>;
}) {
  const query = await searchParams;
  const user = await requireUser();
  const pf = await loadPortfolio(user.id);
  const today = todayIso();
  const rowById = new Map(pf.rows.map((r) => [r.id, r]));
  const typeOf = (e: (typeof pf.miscEvents)[number]) =>
    e.entryType === "buyback" ? "Share buyback" : ASSET_RULES[e.assetType].label;

  const earliest = pf.miscEvents.map((e) => e.date).sort()[0] ?? today;
  const period = resolvePeriod({ ...query, period: query.period ?? "all" }, today);
  const options = fyOptions(pf.miscEvents.length ? earliest : null, today).map((fy, i) => ({
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

  const typeOptions = [...new Set(pf.miscEvents.map(typeOf))].sort();
  const filters = readFilters(query, ["ty", "sign", "adj"], { ty: typeOptions, sign: ["Profit", "Loss"], adj: ["Yes", "No"] });
  const fq = filterQs(filters);
  const withF = fq ? `&${fq}` : "";
  const q = (query.q ?? "").trim();
  const needle = q.toLowerCase();
  const sort = parseSort(query, SORT_KEYS, { key: "date", dir: "desc" });
  const sortQuery = `sort=${sort.key}&dir=${sort.dir}`;
  const withQ = q ? `&q=${encodeURIComponent(q)}` : "";

  const shown = pf.miscEvents.filter(
    (e) =>
      inPeriod(e.date, period) &&
      passes(filters.ty, typeOf(e)) &&
      passes(filters.sign, (rowById.get(e.id)?.netGain ?? 0) >= 0 ? "Profit" : "Loss") &&
      passes(filters.adj, e.taxAdjusted ? "Yes" : "No") &&
      (!needle || [typeOf(e), e.note ?? ""].some((s) => s.toLowerCase().includes(needle))),
  );
  const getters: Record<(typeof SORT_KEYS)[number], (e: (typeof shown)[number]) => string | number> = {
    date: (e) => e.date,
    type: (e) => typeOf(e),
    amount: (e) => e.amount,
    brokerage: (e) => e.brokerage,
    tax: (e) => rowById.get(e.id)?.tax ?? 0,
    net: (e) => rowById.get(e.id)?.netGain ?? 0,
    note: (e) => e.note ?? "",
  };
  const entries = sortRows(shown, getters[sort.key], sort.dir);
  const net = entries.reduce((s, e) => s + (rowById.get(e.id)?.netGain ?? 0), 0);
  const filtered = entries.length !== pf.miscEvents.length;

  const head = (label: string, col: (typeof SORT_KEYS)[number], align: "left" | "right" = "left", firstDir: "asc" | "desc" = "asc", className = "") => (
    <SortHeader label={label} col={col} sort={sort} basePath="/misc" query={`${periodQuery}${withQ}${withF}`} align={align} firstDir={firstDir} className={className} />
  );

  return (
    <div>
      <AddMisc
        today={today}
        title="Misc profit / loss"
        description="Record a one-off gain or loss without a buy and sell, such as dividends or F&O."
      >
        {pf.miscEvents.length > 0 && (
          <>
            <ListSearch q={q} basePath="/misc" query={`${periodQuery}&${sortQuery}${withF}`} placeholder="Search type or note" />
            <PeriodFilter
              options={options}
              value={period.value}
              from={period.from ?? ""}
              to={period.to ?? ""}
              earliest={earliest}
              today={today}
              basePath="/misc"
              extraQuery={`${sortQuery}${withQ}${withF}`}
            />
            <FilterBar
              basePath="/misc"
              selected={filters}
              groups={[
                { id: "ty", label: "Type", options: typeOptions.length > 1 ? typeOptions : [] },
                { id: "sign", label: "Result", options: ["Profit", "Loss"] },
                { id: "adj", label: "Tax adjusted", options: ["Yes", "No"] },
              ]}
            />
          </>
        )}
      </AddMisc>
      <div className="space-y-5">
        <SectionCard
          title="Entries"
          description={
            pf.miscEvents.length
              ? `${entries.length} entr${entries.length === 1 ? "y" : "ies"}${filtered ? ` of ${pf.miscEvents.length}` : ""} · net ${formatINR(net)}`
              : undefined
          }
          flush
        >
          {pf.miscEvents.length === 0 ? (
            <EmptyState icon={Receipt} title="No entries yet" text="Press Add misc P/L to record your first one." />
          ) : entries.length === 0 ? (
            <EmptyState icon={Receipt} title="No entries match" text="Try a different period or clear the search and filters." />
          ) : (
            <table className="w-full">
              <thead>
                <tr>
                  {head("Date", "date", "left", "desc", "sticky-col")}
                  {head("Type", "type")}
                  {head("Amount", "amount", "right", "desc")}
                  {head("Brokerage", "brokerage", "right", "desc", "hidden md:table-cell")}
                  <th className="th hidden md:table-cell">Tax adjusted</th>
                  {head("Tax", "tax", "right", "desc")}
                  {head("Net", "net", "right", "desc")}
                  {head("Note", "note", "left", "asc", "hidden md:table-cell")}
                  <th className="th" />
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => {
                  const r = rowById.get(e.id);
                  return (
                    <tr key={e.id}>
                      <td className="td sticky-col">{formatDate(e.date)}</td>
                      <td className="td">{typeOf(e)}</td>
                      <td className={`td text-right font-medium ${e.entryType === "buyback" ? "" : gainClass(e.amount)}`}>
                        {formatINR(e.amount)}
                        {e.entryType === "buyback" && (
                          <div className="text-xs font-normal text-muted">cost {formatINR(e.cost)}</div>
                        )}
                      </td>
                      <td className="td hidden text-right md:table-cell">{e.brokerage ? formatINR(e.brokerage) : "–"}</td>
                      <td className="td hidden md:table-cell">
                        <span className={e.taxAdjusted ? "badge-gain" : "badge-muted"}>
                          {e.taxAdjusted ? "Yes" : "No"}
                        </span>
                      </td>
                      <td className="td text-right">{formatINR(r?.tax ?? 0)}</td>
                      <td className={`td text-right ${gainClass(r?.netGain ?? 0)}`}>{formatINR(r?.netGain ?? 0)}</td>
                      <td className="td hidden max-w-40 truncate text-muted md:table-cell" title={e.note || undefined}>
                        {e.note || "–"}
                      </td>
                      <td className="td text-right">
                        <DeleteButton
                          compact
                          action={deleteMiscAction}
                          id={e.id}
                          label="Delete"
                          ariaLabel={`Delete ${typeOf(e)} entry of ${formatDate(e.date)}`}
                          confirmText="Delete this entry? This cannot be undone."
                        />
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
