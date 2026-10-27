"use client";

import Link from "next/link";
import { BulkBar, useBulkDelete } from "./bulk";

export interface ClosedRow {
  id: string;
  name: string;
  typeLabel: string;
}

/** The "Fully sold" list with the same Edit mode as current holdings. */
export function ClosedHoldings({ rows }: { rows: ClosedRow[] }) {
  const bulk = useBulkDelete(rows.map((r) => r.id));
  const { editing, selected, toggle } = bulk;

  return (
    <>
      <BulkBar bulk={bulk} total={rows.length} />
      <ul className="divide-y divide-line">
        {rows.map((a) => {
          const on = editing && selected.has(a.id);
          return (
            <li key={a.id} className={on ? "bg-primary-soft" : undefined}>
              {editing ? (
                <label className="flex cursor-pointer items-center gap-3 px-5 py-3">
                  <input
                    type="checkbox"
                    className="size-4 accent-[var(--primary)]"
                    checked={on}
                    onChange={() => toggle(a.id)}
                    aria-label={`Select ${a.name}`}
                  />
                  <span className="font-medium">{a.name}</span>
                  <span className="ml-auto text-sm text-muted">{a.typeLabel}</span>
                </label>
              ) : (
                <Link href={`/holdings/${a.id}`} className="flex items-center justify-between px-5 py-3 hover:bg-surface2">
                  <span className="font-medium">{a.name}</span>
                  <span className="text-sm text-muted">{a.typeLabel}</span>
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
