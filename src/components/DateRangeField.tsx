"use client";

import { CalendarRange, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const dmy = (d: string) => (d ? d.split("-").reverse().join("-") : "");
const pad = (n: number) => String(n).padStart(2, "0");
const WEEK = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

/**
 * One field showing "dd-mm-yyyy to dd-mm-yyyy". Opens a calendar: the first click picks the start date,
 * the second the end date (swapped if earlier), then `onChange` fires and the calendar closes.
 */
export function DateRangeField({
  from,
  to,
  today,
  disabled,
  onChange,
}: {
  from: string;
  to: string;
  today: string;
  disabled?: boolean;
  onChange: (from: string, to: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState((from || today).slice(0, 7));
  const [start, setStart] = useState<string | null>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const root = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent | TouchEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const close = () => setOpen(false);
    document.addEventListener("mousedown", down);
    document.addEventListener("touchstart", down);
    document.addEventListener("keydown", key);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", down);
      document.removeEventListener("touchstart", down);
      document.removeEventListener("keydown", key);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  const toggle = () => {
    if (open) return setOpen(false);
    const r = btn.current!.getBoundingClientRect();
    setPos({ top: r.bottom + 6, left: Math.max(8, Math.min(r.left, window.innerWidth - 296)) });
    setView((from || today).slice(0, 7));
    setStart(null);
    setOpen(true);
  };

  const pick = (d: string) => {
    if (start === null) return setStart(d);
    const [a, b] = start <= d ? [start, d] : [d, start];
    setOpen(false);
    onChange(a, b);
  };

  const [y, m] = view.split("-").map(Number);
  const lead = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const shift = (n: number) => {
    const d = new Date(Date.UTC(y, m - 1 + n, 1));
    setView(`${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`);
  };
  const [lo, hi] = start !== null ? [start, ""] : [from, to];

  return (
    <div ref={root} className="shrink-0">
      <button
        ref={btn}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Select date range"
        disabled={disabled}
        onClick={toggle}
        className="input !flex !h-9 !w-auto items-center gap-1.5 whitespace-nowrap !px-2 text-[13px] disabled:opacity-60 sm:gap-2 sm:!px-3 sm:text-sm"
      >
        <CalendarRange size={15} className="shrink-0 text-muted" />
        <span>
          {dmy(from)} <span className="text-muted">to</span> {dmy(to)}
        </span>
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Choose dates"
          style={{ top: pos.top, left: pos.left }}
          className="fixed z-[90] w-72 rounded-xl border border-line bg-surface p-3 shadow-xl"
        >
          <div className="mb-1 flex items-center justify-between">
            <button type="button" aria-label="Previous month" onClick={() => shift(-1)} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-surface2 hover:text-ink">
              <ChevronLeft size={18} />
            </button>
            <b className="text-sm font-semibold">
              {new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" })}
            </b>
            <button type="button" aria-label="Next month" onClick={() => shift(1)} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-surface2 hover:text-ink">
              <ChevronRight size={18} />
            </button>
          </div>
          <p className="mb-2 min-h-[18px] text-xs text-muted">
            {start === null ? "Select the " : "Now select the "}
            <b className="font-medium text-primary-strong">{start === null ? "start date" : "end date"}</b>
          </p>
          <div className="grid grid-cols-7 gap-y-0.5 text-center">
            {WEEK.map((w) => (
              <span key={w} className="py-1 text-xs text-muted">
                {w}
              </span>
            ))}
            {Array.from({ length: lead }, (_, i) => (
              <span key={`b${i}`} />
            ))}
            {Array.from({ length: days }, (_, i) => {
              const iso = `${view}-${pad(i + 1)}`;
              const edge = iso === lo || iso === hi;
              const inside = lo && hi && iso > lo && iso < hi;
              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => pick(iso)}
                  className={`h-9 text-[13px] ${
                    edge
                      ? "rounded-lg bg-primary text-(--on-primary)"
                      : inside
                        ? "bg-primary-soft"
                        : "rounded-lg hover:bg-surface2"
                  } ${iso === today && !edge ? "rounded-lg ring-1 ring-inset ring-primary" : ""}`}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
