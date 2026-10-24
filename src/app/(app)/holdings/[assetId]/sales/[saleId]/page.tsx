import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteButton } from "@/components/DeleteButton";
import { PageHeader } from "@/components/ui";
import { todayIso } from "@/domain/dates";
import { requireUser } from "@/features/auth/session";
import { loadPortfolio } from "@/features/portfolio/data";
import { deleteSaleAction } from "@/features/sales/actions";
import { SellForm } from "@/features/sales/SellForm";

export default async function EditSalePage({ params }: { params: Promise<{ assetId: string; saleId: string }> }) {
  const { assetId, saleId } = await params;
  const user = await requireUser();
  const pf = await loadPortfolio(user.id);
  const asset = pf.assets.find((a) => a.id === assetId);
  const sale = pf.saleEvents.find((s) => s.id === saleId && s.assetId === assetId);
  if (!asset || !sale) notFound();

  const ownAllocated = new Map(sale.allocations.map((a) => [a.lotId, a.qty]));
  const available = pf.lots
    .filter((l) => l.assetId === assetId)
    .reduce((sum, l) => sum + l.qty - (pf.sold.get(l.id) ?? 0) + (ownAllocated.get(l.id) ?? 0), 0);

  return (
    <div>
      <Link
        href={`/holdings/${assetId}`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink"
      >
        <ArrowLeft size={15} />
        {asset.name}
      </Link>
      <PageHeader
        title="Edit sale"
        description="Changing a sale re-matches it against your purchases (oldest first) and recalculates tax."
        actions={
          <DeleteButton
            action={deleteSaleAction}
            id={sale.id}
            confirmText="Delete this sale? The units return to your holding."
          />
        }
      />
      <SellForm
        assetId={asset.id}
        saleId={sale.id}
        isSgb={asset.type === "sgb"}
        maxQty={available}
        today={todayIso()}
        initial={{
          sellDate: sale.date,
          qty: sale.qty,
          price: sale.price,
          fees: sale.fees,
          applyTax: sale.applyTax,
          exemptRedemption: sale.exemptRedemption,
          isBuyback: !!sale.buyback,
        }}
      />
    </div>
  );
}
