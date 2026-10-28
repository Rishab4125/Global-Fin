"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const compact = new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 });
const full = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

const axisProps = {
  tick: { fill: "var(--muted)", fontSize: 12 },
  axisLine: { stroke: "var(--line)" },
  tickLine: false,
} as const;

const tooltipStyle = {
  background: "var(--surface)",
  border: "1px solid var(--line)",
  borderRadius: 8,
  color: "var(--ink)",
  fontSize: 13,
};

export function GainByYearChart({ data }: { data: { fy: string; net: number; gain: number }[] }) {
  const summary = data.map((d) => `FY ${d.fy}: ${full.format(d.net)} after tax`).join(". ");
  return (
    <div role="img" aria-label={`Post-tax gain by financial year. ${summary || "No data yet."}`} className="amt">
    <ResponsiveContainer width="100%" height={Math.max(120, data.length * 44 + 36)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" {...axisProps} tickFormatter={(v) => compact.format(v)} />
        <YAxis type="category" dataKey="fy" {...axisProps} width={68} />
        <Tooltip
          contentStyle={tooltipStyle}
          cursor={{ fill: "var(--surface-2)" }}
          formatter={(v) => [full.format(Number(v)), "Post-tax gain"]}
          labelFormatter={(l) => `FY ${l}`}
        />
        <Bar dataKey="net" radius={[0, 4, 4, 0]} maxBarSize={28}>
          {data.map((d) => (
            <Cell key={d.fy} fill={d.net >= 0 ? "var(--gain)" : "var(--loss)"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
    </div>
  );
}

/** Colours for the slices, largest first. Restrained greens with one gold; the legend uses the same list. */
export const MIX_COLORS = ["#0f7a4a", "#34a874", "#5d7f6e", "#8fb8a2", "#c58a2b", "#a9bdb2", "#b45a3c", "#7a8c84", "#cbd5cf"];

export function MixDonut({ data, label }: { data: { name: string; value: number; color: string }[]; label: string }) {
  const summary = data.map((d) => `${d.name}: ${full.format(d.value)}`).join(". ");
  return (
    <div role="img" aria-label={`Mix by ${label}. ${summary || "Nothing held yet."}`} className="amt shrink-0">
      <PieChart width={132} height={132}>
        <Pie
          data={data.map((d) => ({ ...d, fill: d.color }))}
          dataKey="value"
          nameKey="name"
          innerRadius={40}
          outerRadius={64}
          paddingAngle={data.length > 1 ? 1 : 0}
          stroke="var(--surface)"
          strokeWidth={2}
          isAnimationActive={false}
        >
          {data.map((d) => (
            <Cell key={d.name} fill={d.color} />
          ))}
        </Pie>
      </PieChart>
    </div>
  );
}
