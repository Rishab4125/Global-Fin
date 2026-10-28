const full = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

/** Colours for the slices, largest first. Clearly different hues; the legend uses the same list. */
export const MIX_COLORS = ["#0f7a4a", "#c58a2b", "#2f6fb0", "#b45a3c", "#7a5aa6", "#2a9d9d", "#8a8f94", "#c26a8f", "#6b8e23"];

/** A donut drawn as plain SVG: one circle per slice, so every slice takes the colour it is given. */
export function MixDonut({ data, label }: { data: { name: string; value: number; color: string }[]; label: string }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const summary = data.map((d) => `${d.name}: ${full.format(d.value)}`).join(". ");
  const gap = data.length > 1 ? 0.8 : 0;
  let used = 0;
  return (
    <div role="img" aria-label={`Mix by ${label}. ${summary || "Nothing held yet."}`} className="amt shrink-0">
      <svg viewBox="0 0 42 42" width={128} height={128} className="-rotate-90">
        <circle cx="21" cy="21" r="15.9155" fill="none" stroke="var(--surface-2)" strokeWidth="6" />
        {total > 0 &&
          data.map((d) => {
            const share = (d.value / total) * 100;
            const start = used;
            used += share;
            return (
              <circle
                key={d.name}
                cx="21"
                cy="21"
                r="15.9155"
                fill="none"
                stroke={d.color}
                strokeWidth="6"
                strokeDasharray={`${Math.max(share - gap, 0.1)} ${100 - Math.max(share - gap, 0.1)}`}
                strokeDashoffset={-start}
              />
            );
          })}
      </svg>
    </div>
  );
}
