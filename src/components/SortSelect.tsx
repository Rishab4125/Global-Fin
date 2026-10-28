"use client";

import { ArrowDownUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

interface Option {
  /** "key:dir", e.g. "invested:desc". */
  value: string;
  label: string;
}

/** Sort control for card lists, where there are no column headers to click. Keeps the other filters in `query`. */
export function SortSelect({
  options,
  value,
  basePath,
  query,
}: {
  options: Option[];
  value: string;
  basePath: string;
  /** Current filters without sort, e.g. "q=reliance". */
  query: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <label className="flex min-w-[7rem] flex-1 items-center gap-2 text-sm text-muted sm:flex-none">
      <ArrowDownUp size={16} className="shrink-0" />
      <span className="hidden sm:inline">Sort</span>
      <select
        aria-label="Sort holdings"
        className="input !h-9 min-w-0 !w-full sm:!w-auto sm:min-w-44"
        value={value}
        disabled={pending}
        onChange={(e) => {
          const [key, dir] = e.target.value.split(":");
          start(() => router.replace(`${basePath}?${query ? `${query}&` : ""}sort=${key}&dir=${dir}`));
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
