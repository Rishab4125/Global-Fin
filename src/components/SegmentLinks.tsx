import Link from "next/link";

/** A row of linked segments (like tabs) where each one is its own page. */
export function SegmentLinks({
  label,
  items,
  className = "mb-5",
}: {
  label: string;
  items: { href: string; label: string; active: boolean }[];
  /** Spacing around the row; the default leaves room below it. */
  className?: string;
}) {
  return (
    <nav aria-label={label} className={`${className} max-w-full overflow-x-auto`}>
      <div className="inline-flex gap-0.5 rounded-lg bg-surface2 p-0.5">
        {items.map((i) => (
          <Link
            key={i.href}
            href={i.href}
            aria-current={i.active ? "page" : undefined}
            className={`whitespace-nowrap rounded-md px-3 py-1.5 text-[0.8125rem] font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-primary/40 ${
              i.active ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink"
            }`}
          >
            {i.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

/** Summary, Sales and Misc are three views of the same Gains section. */
export function GainsTabs({ active }: { active: "summary" | "sales" | "misc" }) {
  return (
    <SegmentLinks
      label="Gains sections"
      items={[
        { href: "/gains", label: "Summary", active: active === "summary" },
        { href: "/gains/sales", label: "Sales", active: active === "sales" },
        { href: "/gains/misc", label: "Misc", active: active === "misc" },
      ]}
    />
  );
}
