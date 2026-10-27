import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { FileSpreadsheet } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/features/auth/session";
import { UploadCard } from "@/features/import/UploadCard";

export default async function ImportPage() {
  await requireUser();
  return (
    <div>
      <Link href="/holdings" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft size={16} />
        Holdings
      </Link>
      <PageHeader
        title="Import trades"
        description="Bring in your broker's trade history instead of typing it. Nothing is ever added twice."
      />
      <div className="card mb-5 !p-4">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <FileSpreadsheet size={18} className="text-primary" />
          What to import
        </h2>
        <p className="mt-0.5 text-sm text-muted">CSV or Excel (.xlsx) only. Equity trades only.</p>
        <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2 sm:gap-4">
          <p>
            <b className="font-medium">Zerodha:</b> <span className="text-muted">P&amp;L report (Console, Reports, P&amp;L), not the Tax P&amp;L. It has no trade dates, so buys are dated the report start and sells the report end. Download one financial year at a time.</span>
          </p>
          <p>
            <b className="font-medium">Groww:</b> <span className="text-muted">Stocks order history (Reports).</span>
          </p>
        </div>
      </div>
      <UploadCard />
    </div>
  );
}
