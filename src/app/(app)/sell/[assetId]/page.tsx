import Link from "next/link";
import { notFound } from "next/navigation";
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
    <div className="space-y-5">
      <div>
        <Link href="/holdings" className="text-sm text-primary hover:underline">
          ← Back to holdings
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-primary-strong">Sell {holding.name}</h1>
        <p className="text-sm text-muted">
          {rule.label} · you hold {formatQty(holding.qty)} units. {rule.note}
        </p>
      </div>
      <SellForm assetId={holding.id} isSgb={holding.type === "sgb"} maxQty={holding.qty} today={todayIso()} />
      <p className="text-xs text-muted">
        Oldest purchases are sold first (FIFO). Tax shown is an estimate, not tax advice.
      </p>
    </div>
  );
}
