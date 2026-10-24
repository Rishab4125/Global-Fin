import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import Link from "next/link";
import type { SortState } from "@/lib/sort";

/** Column header that sorts the list by that column; click again to reverse. Keeps the other filters. */
export function SortHeader<K extends string>({
  label,
  col,
  sort,
  basePath,
  query,
  align = "left",
  firstDir = "asc",
}: {
  label: string;
  col: K;
  sort: SortState<K>;
  basePath: string;
  /** Current filters without sort/dir, e.g. "period=all&q=tcs". */
  query: string;
  align?: "left" | "right";
  /** Direction used the first time this column is clicked. */
  firstDir?: "asc" | "desc";
}) {
  const active = sort.key === col;
  const next = active ? (sort.dir === "asc" ? "desc" : "asc") : firstDir;
  const href = `${basePath}?${query}${query ? "&" : ""}sort=${col}&dir=${next}`;
  const Icon = !active ? ChevronsUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;

  return (
    <th
      className={`th ${align === "right" ? "text-right" : ""}`}
      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
    >
      <Link
        href={href}
        className={`inline-flex items-center gap-1 hover:text-ink ${active ? "text-ink" : ""} ${
          align === "right" ? "flex-row-reverse" : ""
        }`}
      >
        {label}
        <Icon size={13} className={active ? "" : "opacity-40"} />
      </Link>
    </th>
  );
}
