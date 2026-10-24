import { ArrowLeft } from "lucide-react";
import Link from "next/link";
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
      <UploadCard />
    </div>
  );
}
