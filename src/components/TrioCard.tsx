import { ResponsiveAmount } from "@/components/Amount";
import { formatINRCompact, formatINRWhole } from "@/lib/format";

/**
 * One of the three realised cards (gain, tax, post-tax). Always sits three across; the labels shorten and the amount
 * switches to the lakh/crore form on a very narrow phone so a value never drops to a second line.
 */
export function TrioCard({
  short,
  long,
  value,
  hint,
  hero = false,
  valueClass = "",
}: {
  short: string;
  long: string;
  value: number;
  hint?: string;
  hero?: boolean;
  valueClass?: string;
}) {
  return (
    <div className={`min-w-0 rounded-xl border p-3 sm:p-4 ${hero ? "border-primary/40 bg-primary-soft" : "border-line bg-surface"}`}>
      <p className="t-label truncate">
        <span className="min-[420px]:hidden">{short}</span>
        <span className="hidden min-[420px]:inline">{long}</span>
      </p>
      <p className={`mt-1.5 whitespace-nowrap text-base leading-[1.2] font-semibold sm:text-lg xl:text-xl ${valueClass}`}>
        <ResponsiveAmount whole={formatINRWhole(value)} compact={formatINRCompact(value)} />
      </p>
      {hint && <p className="t-caption mt-1.5 [overflow-wrap:anywhere]">{hint}</p>}
    </div>
  );
}
