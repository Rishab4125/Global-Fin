"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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
    <div role="img" aria-label={`Post-tax gain by financial year. ${summary || "No data yet."}`}>
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="fy" {...axisProps} />
        <YAxis {...axisProps} tickFormatter={(v) => compact.format(v)} width={56} />
        <Tooltip
          contentStyle={tooltipStyle}
          cursor={{ fill: "var(--surface-2)" }}
          formatter={(v) => [full.format(Number(v)), "Post-tax gain"]}
          labelFormatter={(l) => `FY ${l}`}
        />
        <Bar dataKey="net" radius={[4, 4, 0, 0]} maxBarSize={48}>
          {data.map((d) => (
            <Cell key={d.fy} fill={d.net >= 0 ? "var(--gain)" : "var(--loss)"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
    </div>
  );
}

export function AllocationChart({ data }: { data: { group: string; cost: number }[] }) {
  const summary = data.map((d) => `${d.group}: ${full.format(d.cost)} invested`).join(". ");
  return (
    <div role="img" aria-label={`Amount invested by asset class. ${summary || "No data yet."}`}>
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 44 + 20)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
        <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" {...axisProps} tickFormatter={(v) => compact.format(v)} />
        <YAxis type="category" dataKey="group" {...axisProps} width={96} />
        <Tooltip
          contentStyle={tooltipStyle}
          cursor={{ fill: "var(--surface-2)" }}
          formatter={(v) => [full.format(Number(v)), "Invested"]}
        />
        <Bar dataKey="cost" fill="var(--primary)" radius={[0, 4, 4, 0]} maxBarSize={26} />
      </BarChart>
    </ResponsiveContainer>
    </div>
  );
}
