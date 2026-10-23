import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { todayIso } from "@/domain/dates";
import { ASSET_RULES } from "@/domain/taxRules";
import { requireUser } from "@/features/auth/session";
import { loadPortfolio } from "@/features/portfolio/data";
import { SellForm } from "@/features/sales/SellForm";
import { formatQty } from "@/lib/format";

export default async function SellPage({ params }: { params: Promise<{ assetId: string }> }) {
  const { assetId } = await params;
  const user = await requireUser();
  const pf = await loadPortfolio(user.id);
  const holding = pf.holdings.find((h) => h.id === assetId);
  if (!holding) notFound();
  const rule = ASSET_RULES[holding.type];

  return (
    <div>
      <Link href="/holdings" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft size={15} />
        Holdings
      </Link>
      <PageHeader
        title={`Sell ${holding.name}`}
        description={`${rule.label} · you hold ${formatQty(holding.qty)} units`}
      />
      <div className="mb-5 rounded-lg border border-line bg-surface2 px-4 py-3 text-[13px] text-muted">
        {rule.note} Oldest purchases are sold first (FIFO). Tax shown is an estimate, not advice.
      </div>
      <SellForm assetId={holding.id} isSgb={holding.type === "sgb"} maxQty={holding.qty} today={todayIso()} />
    </div>
  );
}
