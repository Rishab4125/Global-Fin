import { PageHeader, SectionCard } from "@/components/ui";
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
    <div>
      <PageHeader title="Settings" description="Your tax assumptions and the rules this app applies." />
      <div className="space-y-5">
        <SlabForm slabPercent={+(pf.slabRate * 100).toFixed(2)} />
        <SectionCard
          title="Tax rules applied"
          description="Rates after 23 Jul 2024, plus 4% cess. Surcharge is not included. Share buybacks from 1 Oct 2024 are taxed as dividend at your slab rate. An estimate, not tax advice."
          flush
        >
          <table className="w-full">
            <thead>
              <tr>
                <th className="th">Asset</th>
                <th className="th">Long term after</th>
                <th className="th">Short term</th>
                <th className="th">Long term</th>
              </tr>
            </thead>
            <tbody>
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
        </SectionCard>

        <SectionCard title="Account" description="Your data is stored against this Google account ID.">
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="kpi-label">Signed in as</dt>
              <dd className="mt-1 break-all font-medium">{user.email || user.name}</dd>
            </div>
            <div>
              <dt className="kpi-label">Account ID</dt>
              <dd className="mt-1 break-all font-mono text-xs">{user.id}</dd>
            </div>
          </dl>
        </SectionCard>

        <SectionCard title="About">
          <p className="text-sm text-muted">
            Global Fin is created by <span className="font-medium text-ink">Rishab Gupta</span>. Tax figures are
            estimates, not tax advice.
          </p>
        </SectionCard>
      </div>
    </div>
  );
}
