"use client";

import Link from "next/link";
import { BulkBar, useBulkDelete } from "./bulk";

export interface HoldingCardData {
  id: string;
  name: string;
  typeLabel: string;
  platforms: string[];
  qty: string;
  avgCost: string;
  cost: string;
  since: string;
  share: string;
}

const PLATFORM_BADGE: Record<string, string> = { Zerodha: "badge-gain", Groww: "badge-warn" };

/**
 * Holdings as KPI cards (no horizontal scrolling) with an Edit mode: tick holdings (or Select all) and delete them.
 */
export function HoldingsGrid({ rows }: { rows: HoldingCardData[] }) {
  const bulk = useBulkDelete(rows.map((r) => r.id));
  const { editing, selected, toggle } = bulk;

  return (
    <>
      <BulkBar bulk={bulk} total={rows.length} />

      <ul className="grid gap-3 p-3 sm:grid-cols-2 sm:gap-4 sm:p-4 xl:grid-cols-3 2xl:grid-cols-4">
        {rows.map((h) => {
          const on = editing && selected.has(h.id);
          return (
            <li
              key={h.id}
              className={`flex flex-col rounded-xl border bg-surface p-4 transition ${
                on ? "border-primary bg-primary-soft ring-1 ring-primary" : "border-line"
              }`}
            >
              <div className="flex items-start gap-3">
                {editing && (
                  <input
                    type="checkbox"
                    className="mt-1 size-4 shrink-0 accent-[var(--primary)]"
                    checked={on}
                    onChange={() => toggle(h.id)}
                    aria-label={`Select ${h.name}`}
                  />
                )}
                <div className="min-w-0 flex-1">
                  {editing ? (
                    <span className="block truncate font-semibold">{h.name}</span>
                  ) : (
                    <Link href={`/holdings/${h.id}`} className="block truncate font-semibold hover:text-primary hover:underline">
                      {h.name}
                    </Link>
                  )}
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-muted">{h.typeLabel}</span>
                    {h.platforms.map((p) => (
                      <span key={p} className={PLATFORM_BADGE[p] ?? "badge-muted"}>
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="kpi-label">Invested</div>
                  <div className="num text-lg font-semibold leading-tight">{h.cost}</div>
                </div>
              </div>

              <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-line pt-3">
                <Stat label="Quantity" value={h.qty} />
                <Stat label="Avg cost" value={h.avgCost} />
                <Stat label="Portfolio" value={h.share} />
              </dl>

              <div className="mt-3 flex items-center justify-between gap-2">
                <span className="text-xs text-muted">Since {h.since}</span>
                {!editing && (
                  <div className="flex gap-2">
                    <Link href={`/holdings/${h.id}`} className="btn-ghost !h-8 !px-3">
                      Details
                    </Link>
                    <Link href={`/sell/${h.id}`} className="btn-accent !h-8 !px-3">
                      Sell
                    </Link>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="kpi-label">{label}</dt>
      <dd className="num mt-0.5 truncate text-sm font-medium">{value}</dd>
    </div>
  );
}
