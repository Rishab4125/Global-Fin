import { ASSET_RULES, ASSET_TYPE_IDS, type Rate } from "@/domain/taxRules";
import { requireUser } from "@/features/auth/session";
import { loadPortfolio } from "@/features/portfolio/data";
import { SlabForm } from "@/features/settings/SlabForm";

const rateText = (r: Rate) =>
  r.kind === "slab" ? "Slab rate" : r.kind === "exempt" ? "Exempt" : `${+(r.rate * 100).toFixed(2)}%`;

export default async function SettingsPage() {
  const user = await requireUser();
  const pf = await loadPortfolio(user.id);

  return (
    <div className="space-y-6">
      <SlabForm slabPercent={+(pf.slabRate * 100).toFixed(2)} />
      <section className="card overflow-x-auto p-0">
        <h2 className="px-5 pt-5 text-lg font-semibold text-primary-strong">Tax rules applied</h2>
        <p className="px-5 pt-1 text-xs text-muted">
          Rates after 23 Jul 2024, plus 4% cess. Surcharge is not included. This is an estimate, not tax advice.
        </p>
        <table className="mt-3 w-full">
          <thead className="border-b border-line">
            <tr>
              <th className="th">Asset</th>
              <th className="th">Long term after</th>
              <th className="th">Short term</th>
              <th className="th">Long term</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {ASSET_TYPE_IDS.map((id) => {
              const r = ASSET_RULES[id];
              return (
                <tr key={id}>
                  <td className="td font-medium">{r.label}</td>
                  <td className="td">{r.longTermMonths ? `${r.longTermMonths} months` : "n/a"}</td>
                  <td className="td">{rateText(r.stcg)}</td>
                  <td className="td">
                    {rateText(r.ltcg)}
                    {r.usesEquityExemption && <span className="text-muted"> (first ₹1.25L/yr exempt)</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}
