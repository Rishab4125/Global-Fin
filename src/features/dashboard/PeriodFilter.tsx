"use client";

import { CalendarRange } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { DateRangeField } from "@/components/DateRangeField";
import { fyRange } from "@/domain/period";

interface Option {
  value: string;
  label: string;
}

/**
 * Period picker (dashboard, transactions). Choosing a financial year (or All time) fills in the date fields;
 * editing the dates directly analyses exactly that range.
 */
export function PeriodFilter({
  options,
  value,
  from,
  to,
  earliest,
  today,
  basePath = "/dashboard",
  extraQuery = "",
}: {
  options: Option[];
  value: string;
  from: string;
  to: string;
  earliest: string;
  today: string;
  basePath?: string;
  /** Other query params to keep when the period changes, e.g. "q=reliance". */
  extraQuery?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const initialFrom = value === "all" ? earliest : from;
  const initialTo = value === "all" ? today : to;
  const [selected, setSelected] = useState(value === "custom" ? "" : value);
  const [f, setF] = useState(initialFrom);
  const [t, setT] = useState(initialTo);

  const go = (qs: string) => start(() => router.push(`${basePath}?${qs}${extraQuery ? `&${extraQuery}` : ""}`));

  const choose = (v: string) => {
    setSelected(v);
    if (v === "all") {
      setF(earliest);
      setT(today);
      go("period=all");
      return;
    }
    const r = fyRange(v.slice(3));
    setF(r.from);
    setT(r.to);
    go(`period=${encodeURIComponent(v)}`);
  };

  const changeDates = (nf: string, nt: string) => {
    setF(nf);
    setT(nt);
    if (!nf || !nt) return;
    const [a, b] = nf <= nt ? [nf, nt] : [nt, nf];
    const fy = options.find((o) => {
      if (!o.value.startsWith("fy:")) return false;
      const r = fyRange(o.value.slice(3));
      return r.from === a && r.to === b;
    });
    if (fy) {
      setSelected(fy.value);
      go(`period=${encodeURIComponent(fy.value)}`);
    } else if (a === earliest && b === today) {
      setSelected("all");
      go("period=all");
    } else {
      setSelected("");
      go(`period=custom&from=${a}&to=${b}`);
    }
  };

  return (
    <div className="flex w-full items-center gap-2 sm:w-auto">
      <span className="hidden items-center gap-2 text-sm text-muted sm:flex">
        <CalendarRange size={16} />
        <span>Period</span>
      </span>
      <select
        aria-label="Analysis period"
        className="input !h-9 !w-auto min-w-0 flex-1 sm:min-w-44 sm:flex-none"
        value={selected}
        disabled={pending}
        onChange={(e) => choose(e.target.value)}
      >
        {selected === "" && (
          <option value="" disabled>
            Select period
          </option>
        )}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
        <option value="all">All time</option>
      </select>
      <DateRangeField from={f} to={t} today={today} disabled={pending} onChange={changeDates} />
    </div>
  );
}
