import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteButton } from "@/components/DeleteButton";
import { PageHeader } from "@/components/ui";
import { todayIso } from "@/domain/dates";
import { requireUser } from "@/features/auth/session";
import { EditBuyForm } from "@/features/holdings/EditBuyForm";
import { deleteLotAction } from "@/features/holdings/actions";
import { loadPortfolio } from "@/features/portfolio/data";

export default async function EditLotPage({ params }: { params: Promise<{ assetId: string; lotId: string }> }) {
  const { assetId, lotId } = await params;
  const user = await requireUser();
  const pf = await loadPortfolio(user.id);
  const asset = pf.assets.find((a) => a.id === assetId);
  const lot = pf.lots.find((l) => l.id === lotId && l.assetId === assetId);
  if (!asset || !lot) notFound();
  const sold = pf.sold.get(lot.id) ?? 0;

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
        title="Edit purchase"
        description={sold > 0 ? `${sold} units from this purchase are already sold.` : "Update the details of this purchase."}
        actions={
          sold > 0 ? undefined : (
            <DeleteButton action={deleteLotAction} id={lot.id} confirmText="Delete this purchase? This cannot be undone." />
          )
        }
      />
      <EditBuyForm
        lotId={lot.id}
        today={todayIso()}
        minQty={sold}
        initial={{ buyDate: lot.buyDate, qty: lot.qty, price: lot.unitPrice, fees: lot.fees }}
      />
    </div>
  );
}
