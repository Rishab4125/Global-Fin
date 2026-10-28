import { Download } from "lucide-react";
import Link from "next/link";
import { PageHeader, SectionCard } from "@/components/ui";
import { DeleteAllData } from "@/features/profile/Managers";

export const metadata = { title: "Data" };

export default function DataPage() {
  return (
    <div>
      <PageHeader title="Data" description="Take your data out, bring more in, or remove it." />
      <div className="space-y-5">
        <SectionCard title="Export all data" description="Every purchase, sale, event and misc entry as one CSV file.">
          <a href="/profile/data/export" className="btn-ghost">
            <Download size={16} />
            Export all data (CSV)
          </a>
        </SectionCard>
        <SectionCard title="Import trades" description="Zerodha or Groww reports.">
          <Link href="/holdings/import" className="btn-ghost">
            Import trades
          </Link>
        </SectionCard>
        <SectionCard title="Delete my data" description="Removes everything stored for this account.">
          <DeleteAllData />
        </SectionCard>
      </div>
    </div>
  );
}
