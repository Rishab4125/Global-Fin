"use client";

import { Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { deleteHoldingsAction } from "./actions";

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
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  // Only holdings still on screen count, e.g. after a search narrows the list.
  const chosen = rows.filter((r) => selected.has(r.id));
  const allChosen = rows.length > 0 && chosen.length === rows.length;

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const finish = () => {
    setEditing(false);
    setSelected(new Set());
    setError(undefined);
  };

  const remove = () => {
    const n = chosen.length;
    const text = `Delete ${n} holding${n === 1 ? "" : "s"}? This also deletes ${
      n === 1 ? "its" : "their"
    } purchases, sales and realised gains. This cannot be undone.`;
    if (!n || !window.confirm(text)) return;
    setError(undefined);
    start(async () => {
      const res = await deleteHoldingsAction(chosen.map((r) => r.id));
      if (res?.error) setError(res.error);
      else finish();
    });
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5 sm:px-5">
        {editing ? (
          <>
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                className="size-4 accent-[var(--primary)]"
                checked={allChosen}
                onChange={() => setSelected(allChosen ? new Set() : new Set(rows.map((r) => r.id)))}
              />
              Select all
              <span className="font-normal text-muted">
                ({chosen.length} of {rows.length} selected)
              </span>
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={!chosen.length || pending}
                onClick={remove}
                className="btn !h-9 border border-loss/30 text-loss hover:bg-loss/10"
              >
                <Trash2 size={15} />
                {pending ? "Deleting…" : `Delete${chosen.length ? ` (${chosen.length})` : ""}`}
              </button>
              <button type="button" onClick={finish} disabled={pending} className="btn-ghost !h-9">
                Done
              </button>
            </div>
          </>
        ) : (
          <>
            <span className="text-sm text-muted">{rows.length} shown</span>
            <button type="button" onClick={() => setEditing(true)} className="btn-ghost !h-9">
              <Pencil size={15} />
              Edit
            </button>
          </>
        )}
      </div>
      {error && (
        <p role="alert" className="border-b border-line bg-loss/10 px-5 py-2 text-sm text-loss">
          {error}
        </p>
      )}

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
