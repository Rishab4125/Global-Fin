import Link from "next/link";
import { ASSET_RULES } from "@/domain/taxRules";
import { requireUser } from "@/features/auth/session";
import { loadPortfolio } from "@/features/portfolio/data";
import { byAssetGroup, totals } from "@/features/reports/summary";
import { formatDate, formatINR, formatQty, gainClass } from "@/lib/format";

export default async function RealisedPage({
  searchParams,
}: {
  searchParams: Promise<{ fy?: string }>;
}) {
  const { fy = "all" } = await searchParams;
  const user = await requireUser();
  const pf = await loadPortfolio(user.id);

  const years = [...new Set(pf.rows.map((r) => r.fy))].sort().reverse();
  const rows = pf.rows
    .filter((r) => fy === "all" || r.fy === fy)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  const t = totals(rows);
  const groups = byAssetGroup(rows);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary-strong">Realised gains</h1>
        <div className="flex flex-wrap items-center gap-2">
          {["all", ...years].map((y) => (
            <Link
              key={y}
              href={`/realised?fy=${y}`}
              className={`rounded-full border px-3 py-1 text-sm ${
                y === fy ? "border-primary bg-primary text-white" : "border-line bg-surface hover:bg-surface2"
              }`}
            >
              {y === "all" ? "All years" : `FY ${y}`}
            </Link>
          ))}
          <a href={`/realised/export?fy=${fy}`} className="btn-ghost !py-1">
            Export CSV
          </a>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Kpi label="Gross gain" value={formatINR(t.gain)} cls={gainClass(t.gain)} />
        <Kpi label="Estimated tax" value={formatINR(t.tax)} />
        <Kpi label="Post-tax gain" value={formatINR(t.net)} cls={gainClass(t.net)} />
      </div>

      {groups.length > 0 && (
        <section className="card">
          <h2 className="mb-3 text-lg font-semibold text-primary-strong">By asset class</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {groups.map((g) => (
              <div key={g.group} className="rounded-xl bg-surface2 p-3">
                <div className="text-sm font-medium">{g.group}</div>
                <div className={`text-lg font-semibold ${gainClass(g.gain)}`}>{formatINR(g.gain)}</div>
                <div className="text-xs text-muted">
                  Tax {formatINR(g.tax)} · Net {formatINR(g.net)}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="card overflow-x-auto p-0">
        {rows.length === 0 ? (
          <p className="px-5 py-8 text-sm text-muted">No realised gains yet. Sell a holding or add a misc entry.</p>
        ) : (
          <table className="w-full">
            <thead className="border-b border-line">
              <tr>
                <th className="th">Date</th>
                <th className="th">Asset</th>
                <th className="th text-right">Qty</th>
                <th className="th text-right">Proceeds</th>
                <th className="th text-right">Cost</th>
                <th className="th text-right">Short term</th>
                <th className="th text-right">Long term</th>
                <th className="th text-right">Tax</th>
                <th className="th text-right">Net</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="td whitespace-nowrap">{formatDate(r.date)}</td>
                  <td className="td">
                    {r.label}
                    <div className="text-xs text-muted">
                      {ASSET_RULES[r.assetType].label}
                      {!r.taxApplied && " · no tax applied"}
                      {r.note && ` · ${r.note}`}
                    </div>
                  </td>
                  <td className="td text-right">{r.qty === null ? "–" : formatQty(r.qty)}</td>
                  <td className="td text-right">{r.proceeds === null ? "–" : formatINR(r.proceeds)}</td>
                  <td className="td text-right">{r.cost === null ? "–" : formatINR(r.cost)}</td>
                  <td className={`td text-right ${gainClass(r.stcg)}`}>{formatINR(r.stcg)}</td>
                  <td className={`td text-right ${gainClass(r.ltcg)}`}>{formatINR(r.ltcg)}</td>
                  <td className="td text-right">{formatINR(r.tax)}</td>
                  <td className={`td text-right font-semibold ${gainClass(r.netGain)}`}>{formatINR(r.netGain)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function Kpi({ label, value, cls = "" }: { label: string; value: string; cls?: string }) {
  return (
    <div className="card">
      <div className="label">{label}</div>
      <div className={`text-2xl font-bold ${cls}`}>{value}</div>
    </div>
  );
}
