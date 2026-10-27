"use client";

import Link from "next/link";
import { BulkBar, useBulkDelete } from "./bulk";

export interface HoldingRow {
  id: string;
  name: string;
  typeLabel: string;
  platform: string;
  qty: string;
  avgCost: string;
  cost: string;
}

/**
 * Holdings table with an Edit mode: tick holdings (or Select all) and delete them in one go.
 * `head` is the header row's cells, rendered on the server so the sort links keep working.
 */
export function HoldingsTable({ rows, head }: { rows: HoldingRow[]; head: React.ReactNode }) {
  const bulk = useBulkDelete(rows.map((r) => r.id));
  const { editing, selected, toggle } = bulk;

  return (
    <>
      <BulkBar bulk={bulk} total={rows.length} />

      <table className="w-full">
        <thead>
          <tr>
            {head}
            <th className="th" />
          </tr>
        </thead>
        <tbody>
          {rows.map((h) => {
            const on = editing && selected.has(h.id);
            return (
              <tr key={h.id} className={on ? "bg-primary-soft" : undefined}>
                <td className={`td sticky-col font-medium ${on ? "!bg-primary-soft" : ""}`}>
                  {editing ? (
                    <label className="flex cursor-pointer items-center gap-3">
                      <input
                        type="checkbox"
                        className="size-4 accent-[var(--primary)]"
                        checked={on}
                        onChange={() => toggle(h.id)}
                        aria-label={`Select ${h.name}`}
                      />
                      {h.name}
                    </label>
                  ) : (
                    <Link href={`/holdings/${h.id}`} className="hover:text-primary hover:underline">
                      {h.name}
                    </Link>
                  )}
                </td>
                <td className="td hidden text-muted md:table-cell">{h.typeLabel}</td>
                <td className="td hidden text-muted md:table-cell">{h.platform}</td>
                <td className="td text-right">{h.qty}</td>
                <td className="td text-right">{h.avgCost}</td>
                <td className="td text-right font-medium">{h.cost}</td>
                <td className="td text-right">
                  {!editing && (
                    <div className="flex justify-end gap-2">
                      <Link href={`/holdings/${h.id}`} className="btn-ghost !hidden !h-8 !px-3 sm:!inline-flex">
                        Details
                      </Link>
                      <Link href={`/sell/${h.id}`} className="btn-accent !h-8 !px-3">
                        Sell
                      </Link>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}
