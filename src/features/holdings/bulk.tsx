"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { deleteHoldingsAction } from "./actions";

/** Edit mode shared by the holdings lists: tick rows, select all, delete the ticked holdings. */
export function useBulkDelete(ids: string[]) {
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  // Only holdings still on screen count, e.g. after a search narrows the list.
  const chosen = ids.filter((id) => selected.has(id));
  const allChosen = ids.length > 0 && chosen.length === ids.length;

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  const toggleAll = () => setSelected(allChosen ? new Set() : new Set(ids));
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
      const res = await deleteHoldingsAction(chosen);
      if (res?.error) setError(res.error);
      else finish();
    });
  };

  return { editing, setEditing, selected, chosen, allChosen, toggle, toggleAll, finish, remove, error, pending };
}

export type BulkState = ReturnType<typeof useBulkDelete>;

export function BulkBar({ bulk, total }: { bulk: BulkState; total: number }) {
  const { editing, chosen, allChosen, pending } = bulk;
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
                onChange={bulk.toggleAll}
              />
              Select all
              <span className="font-normal text-muted">
                ({chosen.length} of {total} selected)
              </span>
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={!chosen.length || pending}
                onClick={bulk.remove}
                className="btn !h-9 border border-loss/30 text-loss hover:bg-loss/10"
              >
                <Trash2 size={15} />
                {pending ? "Deleting…" : `Delete${chosen.length ? ` (${chosen.length})` : ""}`}
              </button>
              <button type="button" onClick={bulk.finish} disabled={pending} className="btn-ghost !h-9">
                Done
              </button>
            </div>
          </>
        ) : (
          <>
            <span className="text-sm text-muted">{total} shown</span>
            <button type="button" onClick={() => bulk.setEditing(true)} className="btn-ghost !h-9">
              <Pencil size={15} />
              Edit
            </button>
          </>
        )}
      </div>
      {bulk.error && (
        <p role="alert" className="border-b border-line bg-loss/10 px-5 py-2 text-sm text-loss">
          {bulk.error}
        </p>
      )}
    </>
  );
}
