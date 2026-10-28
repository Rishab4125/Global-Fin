import { Download, Receipt } from "lucide-react";
import Link from "next/link";
import { Amount } from "@/components/Amount";
import { DeleteButton } from "@/components/DeleteButton";
import { FilterBar } from "@/components/FilterBar";
import { ListSearch } from "@/components/ListSearch";
import { GainsTabs } from "@/components/SegmentLinks";
import { EmptyState, SectionCard } from "@/components/ui";
import { todayIso } from "@/domain/dates";
import { fyOptions } from "@/domain/period";
import { requireUser } from "@/features/auth/session";
import { PeriodFilter } from "@/features/dashboard/PeriodFilter";
import { AddMisc } from "@/features/misc/AddMisc";
import { deleteMiscAction } from "@/features/misc/actions";
import { loadPortfolio } from "@/features/portfolio/data";
import { miscView } from "@/features/reports/realisedFilter";
import { groupMisc } from "@/features/reports/summary";
import { formatDate, formatINR, formatINRWhole, gainClass } from "@/lib/format";

export const metadata = { title: "Gains: Misc" };

export default async function MiscPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string; q?: string; mt?: string; sign?: string; add?: string }>;
}) {
  const query = await searchParams;
  const user = await requireUser();
  const pf = await loadPortfolio(user.id);
  const today = todayIso();

  const view = miscView(pf, query, today);
  const { period, filters, typeOptions, all, rows, typeOf } = view;
  const dividendAsset = new Map(pf.dividendEvents.map((d) => [d.id, d.assetId]));
  const noteOf = new Map(pf.miscEvents.map((m) => [m.id, m.note]));

  const earliest = all.map((r) => r.date).sort()[0] ?? today;
  const options = fyOptions(all.length ? earliest : null, today).map((fy, i) => ({
    value: `fy:${fy}`,
    label: i === 0 ? `FY ${fy} (current)` : `FY ${fy}`,
  }));
  if (period.value.startsWith("fy:") && !options.some((o) => o.value === period.value)) {
    options.push({ value: period.value, label: period.label });
  }

  const q = (query.q ?? "").trim();
  const groups = groupMisc(rows, typeOf);
  const keep = [view.periodQuery, view.fq].filter(Boolean).join("&");
  const exportQs = [view.periodQuery, "kind=misc", view.fq].filter(Boolean).join("&");
  const overview = groups.map((g) => `${g.label} ${formatINRWhole(g.gain)}`).join(" · ");

  return (
    <div>
      <AddMisc
        key={query.add ? "add" : "list"}
        defaultOpen={!!query.add}
        today={today}
        title="Gains"
        description="One-off gains and losses without a buy and sell, such as F&O or interest, and dividends from your holdings."
        tabs={<GainsTabs active="misc" />}
      >
        {all.length > 0 && (
          <>
            <ListSearch q={q} basePath="/gains/misc" query={keep} placeholder="Search type, holding or note" />
            <PeriodFilter
              options={options}
              value={period.value}
              from={period.from ?? ""}
              to={period.to ?? ""}
              earliest={earliest}
              today={today}
              basePath="/gains/misc"
              extraQuery={[q ? `q=${encodeURIComponent(q)}` : "", view.fq].filter(Boolean).join("&")}
            />
            <div className="min-w-0 flex-1">
              <FilterBar
                basePath="/gains/misc"
                selected={filters}
                groups={[
                  { id: "mt", label: "Type", options: typeOptions.length > 1 ? typeOptions : [] },
                  { id: "sign", label: "Result", options: ["Profit", "Loss"] },
                ]}
              />
            </div>
            <a href={`/gains/export?${exportQs}`} aria-label="Export CSV" title="Export CSV" className="btn-ghost shrink-0">
              <Download size={16} />
              <span className="hidden sm:inline">Export CSV</span>
            </a>
          </>
        )}
      </AddMisc>

      {all.length === 0 ? (
        <SectionCard flush>
          <EmptyState icon={Receipt} title="No entries yet" text="Press Add misc P/L, or record a dividend on a holding." />
        </SectionCard>
      ) : rows.length === 0 ? (
        <SectionCard flush>
          <EmptyState icon={Receipt} title="No entries match" text="Try a different period or clear the search and filters." />
        </SectionCard>
      ) : (
        <div className="space-y-5">
          <p className="t-body">
            <span className="t-label mr-2">Gross</span>
            <Amount>{overview}</Amount>
          </p>
          {groups.map((g) => (
            <SectionCard
              key={g.label}
              title={g.label}
              description={`${g.count} entr${g.count === 1 ? "y" : "ies"}`}
              action={
                <div className="num text-right">
                  <div className={`t-value ${gainClass(g.gain)}`}>
                    <Amount>{formatINRWhole(g.gain)}</Amount>
                  </div>
                  <div className="t-caption">
                    after tax <Amount>{formatINRWhole(g.net)}</Amount>
                  </div>
                </div>
              }
              flush
            >
              <ul className="divide-y divide-line">
                {[...g.rows]
                  .sort((a, b) => (a.date < b.date ? 1 : -1))
                  .map((r) => {
                    const assetId = dividendAsset.get(r.id);
                    const note = noteOf.get(r.id);
                    return (
                      <li key={r.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                        <div className="t-caption w-20 shrink-0 sm:w-24">{formatDate(r.date)}</div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={assetId ? "badge-gain" : "badge-muted"}>{assetId ? "Dividend" : g.label}</span>
                            {assetId ? (
                              <Link href={`/holdings/${assetId}?tab=events`} className="t-body-strong truncate hover:text-primary hover:underline">
                                {r.label.replace("Dividend: ", "")}
                              </Link>
                            ) : (
                              note && <span className="t-body truncate">{note}</span>
                            )}
                          </div>
                          {!r.taxApplied && <div className="t-caption">Tax already adjusted</div>}
                        </div>
                        <div className="num shrink-0 text-right">
                          <div className={`t-body-strong ${gainClass(r.gain)}`}>
                            <Amount>{formatINR(r.gain)}</Amount>
                          </div>
                          <div className="t-caption">
                            net <Amount>{formatINR(r.netGain)}</Amount>
                          </div>
                        </div>
                        {assetId ? (
                          <span className="w-9 shrink-0" />
                        ) : (
                          <DeleteButton
                            compact
                            action={deleteMiscAction}
                            id={r.id}
                            label="Delete"
                            ariaLabel={`Delete ${g.label} entry of ${formatDate(r.date)}`}
                            confirmText="Delete this entry? This cannot be undone."
                          />
                        )}
                      </li>
                    );
                  })}
              </ul>
            </SectionCard>
          ))}
        </div>
      )}
    </div>
  );
}
