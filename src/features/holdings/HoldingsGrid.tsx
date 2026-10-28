"use client";

import Link from "next/link";
import { Amount } from "@/components/Amount";
import { BulkBar, useBulkDelete } from "./bulk";

export interface HoldingCardData {
  id: string;
  name: string;
  category: string;
  platforms: string[];
  qty: string;
  avgCost: string;
  /** Invested, in whole rupees. */
  cost: string;
  /** Share of the whole portfolio. */
  share: string;
  tags: string[];
}

export interface HoldingGroupData {
  /** Empty when the list is not grouped. */
  title: string;
  subtotal: string;
  share: string;
  rows: HoldingCardData[];
}

const PLATFORM_BADGE: Record<string, string> = { Zerodha: "badge-gain", Groww: "badge-warn" };

/**
 * Holdings as cards, or on a desktop as a table. A whole card opens the holding; Record sale is the one shortcut.
 * Edit mode ticks holdings (or Select all) for deletion. Groups show their subtotal and share.
 */
export function HoldingsGrid({ groups, table }: { groups: HoldingGroupData[]; table: boolean }) {
  const ids = [...new Set(groups.flatMap((g) => g.rows.map((r) => r.id)))];
  const bulk = useBulkDelete(ids);
  const { editing, selected, toggle } = bulk;

  return (
    <>
      <BulkBar bulk={bulk} total={ids.length} />
      {groups.map((g) => (
        <section key={g.title || "all"} aria-label={g.title || undefined}>
          {g.title && (
            <div className="flex items-baseline justify-between gap-3 px-4 pt-4 sm:px-5">
              <h2 className="t-title">{g.title}</h2>
              <p className="t-caption num">
                <Amount>{g.subtotal}</Amount> · {g.share}
              </p>
            </div>
          )}
          <ul className={`grid gap-3 p-3 sm:grid-cols-2 sm:gap-4 sm:p-4 xl:grid-cols-3 ${table ? "lg:hidden" : "2xl:grid-cols-4"}`}>
            {g.rows.map((h) => {
              const on = editing && selected.has(h.id);
              return (
                <li
                  key={h.id}
                  className={`relative flex flex-col rounded-xl border bg-surface p-4 transition ${
                    on ? "border-primary bg-primary-soft ring-1 ring-primary" : "border-line hover:border-primary/40"
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
                        <span className="t-title block truncate">{h.name}</span>
                      ) : (
                        <Link
                          href={`/holdings/${h.id}`}
                          className="t-title block truncate outline-none after:absolute after:inset-0 after:content-[''] hover:text-primary focus-visible:text-primary"
                        >
                          {h.name}
                        </Link>
                      )}
                      <div className="t-caption mt-1 flex flex-wrap items-center gap-1.5">
                        <span>{h.category}</span>
                        {h.platforms.map((p) => (
                          <span key={p} className={PLATFORM_BADGE[p] ?? "badge-muted"}>
                            {p}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="t-value num">
                        <Amount>{h.cost}</Amount>
                      </div>
                      <div className="t-caption">invested</div>
                    </div>
                  </div>

                  <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-line pt-3">
                    <Stat label="Quantity" value={h.qty} />
                    <Stat label="Avg cost" value={h.avgCost} hide />
                    <Stat label="% of portfolio" value={h.share} />
                  </dl>

                  {!editing && (
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <span className="t-caption min-w-0 truncate">{h.tags.map((t) => `#${t}`).join(" ")}</span>
                      <Link href={`/sell/${h.id}`} className="btn-accent relative z-10 !h-8 shrink-0 !px-3">
                        Record sale
                      </Link>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          {table && (
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full">
                <thead>
                  <tr>
                    {editing && <th className="th w-10" />}
                    <th className="th">Name</th>
                    <th className="th">Category</th>
                    <th className="th">Platform</th>
                    <th className="th text-right">Qty</th>
                    <th className="th text-right">Avg cost</th>
                    <th className="th text-right">Invested</th>
                    <th className="th text-right">Share</th>
                    <th className="th" />
                  </tr>
                </thead>
                <tbody>
                  {g.rows.map((h) => {
                    const on = editing && selected.has(h.id);
                    return (
                      <tr key={h.id} className={on ? "bg-primary-soft" : ""}>
                        {editing && (
                          <td className="td">
                            <input
                              type="checkbox"
                              className="size-4 accent-[var(--primary)]"
                              checked={on}
                              onChange={() => toggle(h.id)}
                              aria-label={`Select ${h.name}`}
                            />
                          </td>
                        )}
                        <td className="td font-medium">
                          {editing ? h.name : (
                            <Link href={`/holdings/${h.id}`} className="hover:text-primary hover:underline">
                              {h.name}
                            </Link>
                          )}
                        </td>
                        <td className="td text-muted">{h.category}</td>
                        <td className="td text-muted">{h.platforms.join(", ")}</td>
                        <td className="td num text-right">{h.qty}</td>
                        <td className="td num text-right">
                          <Amount>{h.avgCost}</Amount>
                        </td>
                        <td className="td num text-right font-medium">
                          <Amount>{h.cost}</Amount>
                        </td>
                        <td className="td num text-right">{h.share}</td>
                        <td className="td text-right">
                          {!editing && (
                            <Link href={`/sell/${h.id}`} className="btn-accent !h-8 !px-3">
                              Record sale
                            </Link>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ))}
    </>
  );
}

function Stat({ label, value, hide = false }: { label: string; value: string; hide?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="t-caption">{label}</dt>
      <dd className="t-body-strong num mt-0.5 truncate">{hide ? <Amount>{value}</Amount> : value}</dd>
    </div>
  );
}
