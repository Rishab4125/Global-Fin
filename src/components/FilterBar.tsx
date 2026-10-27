"use client";

import { ChevronDown, ListFilter, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

export interface FilterGroup {
  id: string;
  label: string;
  options: string[];
}

/**
 * Filter chips for a list page. Each chip opens a checklist (several values can be ticked); on phones the chips
 * collapse into one "Filters" button that opens a bottom sheet. Selections live in the URL as ?id=a,b so views can
 * be shared, and every other query param (search, sort, period) is kept.
 */
export function FilterBar({
  groups,
  selected,
  basePath,
}: {
  groups: FilterGroup[];
  selected: Record<string, string[]>;
  basePath: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState<string | null>(null); // group id, or "*" for the phone sheet
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (open !== "*" && !root.current?.contains(e.target as Node)) setOpen(null);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const push = (next: Record<string, string[]>) => {
    const qs = new URLSearchParams(params.toString());
    for (const g of groups) {
      const v = next[g.id] ?? [];
      if (v.length) qs.set(g.id, v.join(","));
      else qs.delete(g.id);
    }
    const s = qs.toString();
    start(() => router.replace(s ? `${basePath}?${s}` : basePath));
  };
  const toggle = (id: string, value: string) => {
    const cur = selected[id] ?? [];
    push({ ...selected, [id]: cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value] });
  };
  const clearGroup = (id: string) => push({ ...selected, [id]: [] });
  const clearAll = () => push({});

  const visible = groups.filter((g) => g.options.length > 0);
  const count = visible.reduce((s, g) => s + (selected[g.id]?.length ?? 0), 0);
  if (!visible.length) return null;

  return (
    <div ref={root} className="flex w-full flex-wrap items-center gap-2" aria-busy={pending}>
      <div className="hidden flex-wrap gap-2 sm:flex">
        {visible.map((g) => {
          const sel = selected[g.id] ?? [];
          const isOpen = open === g.id;
          return (
            <div key={g.id} className="relative">
              <button
                type="button"
                aria-expanded={isOpen}
                aria-haspopup="true"
                onClick={() => setOpen(isOpen ? null : g.id)}
                className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium transition ${
                  sel.length ? "border-primary/40 bg-primary-soft text-primary-strong" : "border-line bg-surface text-muted hover:text-ink"
                }`}
              >
                {g.label}
                {sel.length > 0 && <span>· {sel.length === 1 ? sel[0] : sel.length}</span>}
                <ChevronDown size={14} />
              </button>
              {isOpen && (
                <div className="absolute left-0 top-full z-30 mt-1.5 max-h-72 min-w-52 overflow-auto rounded-xl border border-line bg-surface p-2 shadow-xl">
                  {g.options.map((o) => (
                    <label key={o} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 text-sm hover:bg-surface2">
                      <input
                        type="checkbox"
                        className="size-4 accent-[var(--primary)]"
                        checked={sel.includes(o)}
                        onChange={() => toggle(g.id, o)}
                      />
                      {o}
                    </label>
                  ))}
                  {sel.length > 0 && (
                    <button type="button" onClick={() => clearGroup(g.id)} className="mx-2 mt-1 text-[13px] text-muted hover:text-ink">
                      Clear
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => setOpen("*")}
        aria-haspopup="dialog"
        className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium sm:hidden ${
          count ? "border-primary/40 bg-primary-soft text-primary-strong" : "border-line bg-surface text-muted"
        }`}
      >
        <ListFilter size={14} />
        Filters{count ? ` (${count})` : ""}
      </button>

      {count > 0 && (
        <div className="flex w-full flex-wrap items-center gap-1.5">
          {visible.flatMap((g) =>
            (selected[g.id] ?? []).map((v) => (
              <button
                key={`${g.id}:${v}`}
                type="button"
                onClick={() => toggle(g.id, v)}
                aria-label={`Remove filter ${g.label}: ${v}`}
                className="inline-flex h-7 items-center gap-1.5 rounded-full bg-primary-soft px-2.5 text-xs font-medium text-primary-strong"
              >
                {g.label}: {v}
                <X size={12} />
              </button>
            )),
          )}
          <button type="button" onClick={clearAll} className="text-[13px] text-muted hover:text-ink">
            Clear all
          </button>
        </div>
      )}

      {open === "*" && (
        <div className="sm:hidden">
          <div className="fixed inset-0 z-[60] bg-black/40" onClick={() => setOpen(null)} />
          <div role="dialog" aria-label="Filters" className="fixed inset-x-0 bottom-0 z-[61] max-h-[80vh] overflow-auto rounded-t-2xl bg-surface p-4 shadow-2xl">
            <div className="mb-2 flex items-center justify-between">
              <b className="text-base">Filters</b>
              <button type="button" onClick={() => setOpen(null)} className="text-sm text-muted">
                Close
              </button>
            </div>
            {visible.map((g) => (
              <div key={g.id} className="my-4">
                <div className="kpi-label">{g.label}</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {g.options.map((o) => {
                    const on = (selected[g.id] ?? []).includes(o);
                    return (
                      <button
                        key={o}
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggle(g.id, o)}
                        className={`h-9 rounded-full border px-3.5 text-sm font-medium ${
                          on ? "border-primary bg-primary-soft text-primary-strong" : "border-line"
                        }`}
                      >
                        {o}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            <div className="mt-5 flex gap-2">
              <button type="button" onClick={clearAll} className="btn-ghost flex-1">
                Clear all
              </button>
              <button type="button" onClick={() => setOpen(null)} className="btn flex-1">
                Show results
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
