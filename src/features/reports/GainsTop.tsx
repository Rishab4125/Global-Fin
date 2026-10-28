import { Download } from "lucide-react";
import { FilterBar } from "@/components/FilterBar";
import { GainsTabs } from "@/components/SegmentLinks";
import { PageHeader } from "@/components/ui";
import { TrioCard } from "@/components/TrioCard";
import { fyOptions } from "@/domain/period";
import { PeriodFilter } from "@/features/dashboard/PeriodFilter";
import type { Portfolio } from "@/features/portfolio/data";
import { formatDate, gainClass } from "@/lib/format";
import { RESULTS, TERMS, type realisedView } from "./realisedFilter";
import { totals } from "./summary";

type Section = "summary" | "sales" | "misc";

/** Header, segments, period and filters, and the three headline cards that Summary and Sales share. */
export function GainsTop({
  pf,
  view,
  today,
  active,
  basePath,
  description,
}: {
  pf: Portfolio;
  view: ReturnType<typeof realisedView>;
  today: string;
  active: Section;
  basePath: string;
  description: string;
}) {
  const { period, filters, groups } = view;
  const t = totals(view.rows);
  const earliest = pf.rows.map((r) => r.date).sort()[0] ?? today;
  const options = fyOptions(pf.rows.length ? earliest : null, today).map((fy, i) => ({
    value: `fy:${fy}`,
    label: i === 0 ? `FY ${fy} (current)` : `FY ${fy}`,
  }));
  if (period.value.startsWith("fy:") && !options.some((o) => o.value === period.value)) {
    options.push({ value: period.value, label: period.label });
  }
  const periodText =
    period.value === "custom" && period.from && period.to ? `${formatDate(period.from)} to ${formatDate(period.to)}` : period.label;
  const exportQs = [view.periodQuery, view.fq].filter(Boolean).join("&");

  return (
    <>
      <PageHeader
        title="Gains"
        description={description}
        actions={
          <a
            href={`/gains/export?${exportQs}`}
            aria-label="Export CSV"
            title="Export CSV"
            className="btn-ghost shrink-0 max-sm:!w-10 max-sm:!min-w-10 max-sm:!px-0"
          >
            <Download size={16} />
            <span className="hidden sm:inline">Export CSV</span>
          </a>
        }
      />
      <div className="mb-4 grid grid-cols-3 gap-2 sm:gap-4">
        <TrioCard short="Gain" long="Gross gain" value={t.gain} valueClass={gainClass(t.gain)} hint={periodText} />
        <TrioCard short="Tax" long="Estimated tax" value={t.tax} hint="Incl. 4% cess" />
        <TrioCard short="Post-tax" long="Post-tax gain" value={t.net} valueClass={gainClass(t.net)} hint={periodText} hero />
      </div>
      <GainsTabs active={active} />
      <div className="flex flex-wrap items-center gap-3">
        <PeriodFilter
          options={options}
          value={period.value}
          from={period.from ?? ""}
          to={period.to ?? ""}
          earliest={earliest}
          today={today}
          basePath={basePath}
          extraQuery={view.fq}
        />
        <div className="min-w-0 flex-1">
          <FilterBar
            basePath={basePath}
            selected={filters}
            groups={[
              { id: "ty", label: "Category", options: groups.length > 1 ? groups : [] },
              { id: "term", label: "Term", options: TERMS },
              { id: "sign", label: "Result", options: RESULTS },
              { id: "pf", label: "Platform", options: pf.platforms },
            ]}
          />
        </div>
      </div>
    </>
  );
}
