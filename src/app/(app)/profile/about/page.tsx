import { PageHeader, SectionCard } from "@/components/ui";

export const metadata = { title: "About" };

export default function AboutPage() {
  return (
    <div>
      <PageHeader title="About" />
      <div className="space-y-5">
        <SectionCard>
          <p className="text-sm text-muted">
            Global Fin is created by <span className="font-medium text-ink">Rishab Gupta</span>. It tracks what you hold,
            what you realised and the tax on it. It does not place orders or give advice.
          </p>
        </SectionCard>
        <SectionCard title="Tax disclaimer">
          <p className="text-sm text-muted">
            Tax figures are estimates, not tax advice. Surcharge and carry-forward of losses are not included, and the
            statutory round-off to ₹10 is not applied. Check with a tax professional before filing.
          </p>
        </SectionCard>
        <SectionCard title="Privacy">
          <p className="text-sm text-muted">
            Your data is stored against your Google account and is not shared. Broker keys you save are stored
            encrypted. You can export or delete everything under Data.
          </p>
        </SectionCard>
      </div>
    </div>
  );
}
