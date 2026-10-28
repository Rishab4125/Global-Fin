import type { ReactNode } from "react";

/** An amount the eye icon can hide. Numbers stay in their column and keep their width when blurred. */
export function Amount({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`amt num ${className}`}>{children}</span>;
}

/**
 * A headline that shows whole rupees, or the lakh/crore form on a very narrow phone where the long form would not
 * fit. Both are in the page; CSS picks one, so nothing waits for JavaScript to measure the screen.
 */
export function ResponsiveAmount({ whole, compact, className = "" }: { whole: string; compact: string; className?: string }) {
  return (
    <span className={`amt num ${className}`}>
      <span className="min-[420px]:hidden">{compact}</span>
      <span className="hidden min-[420px]:inline">{whole}</span>
    </span>
  );
}
