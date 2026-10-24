"use client";

import { Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/** Search box for a list page. Updates ?q= after a short pause and keeps the other filters in `query`. */
export function ListSearch({
  q,
  basePath,
  query,
  placeholder,
}: {
  q: string;
  basePath: string;
  /** Current filters without q, e.g. "period=all&sort=date&dir=desc". */
  query: string;
  placeholder: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(q);

  useEffect(() => {
    const next = value.trim();
    if (next === q) return;
    const id = setTimeout(() => {
      router.replace(`${basePath}?${query}${next ? `${query ? "&" : ""}q=${encodeURIComponent(next)}` : ""}`);
    }, 300);
    return () => clearTimeout(id);
  }, [value, q, basePath, query, router]);

  return (
    <div className="relative w-full sm:w-72">
      <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
      <input
        type="search"
        aria-label="Search"
        placeholder={placeholder}
        className="input !h-9 !pl-9 !pr-9"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted hover:text-ink"
          onClick={() => setValue("")}
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
