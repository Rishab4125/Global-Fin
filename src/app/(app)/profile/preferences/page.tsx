import { PageHeader, SectionCard } from "@/components/ui";
import { ThemeToggle } from "@/components/ThemeToggle";

export const metadata = { title: "Preferences" };

export default function PreferencesPage() {
  return (
    <div>
      <PageHeader title="Preferences" description="How the app looks and shows your numbers." />
      <div className="space-y-5">
        <SectionCard title="Theme" description="Starts from your device setting until you pick one.">
          <div className="max-w-xs">
            <ThemeToggle variant="segmented" />
          </div>
        </SectionCard>
        <SectionCard title="Mix shows" description="Your mix on the dashboard is by what you paid (cost). A by-value view arrives once prices are added.">
          <p className="text-sm text-muted">Cost</p>
        </SectionCard>
        <SectionCard title="Number format" description="Amounts use Indian grouping (₹12,34,567). Headlines are whole rupees; tables show paise.">
          <p className="text-sm text-muted">Indian (lakh and crore)</p>
        </SectionCard>
      </div>
    </div>
  );
}
