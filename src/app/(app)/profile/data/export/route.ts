import { unitsAt } from "@/domain/corporateActions";
import { ASSET_RULES } from "@/domain/taxRules";
import { requireUser } from "@/features/auth/session";
import { loadPortfolio } from "@/features/portfolio/data";
import { csvCell } from "@/features/reports/summary";
import { csvMoney, csvQty } from "@/lib/format";

/** Everything the user has recorded, one row per purchase, sale, event or misc entry, oldest first. */
export async function GET() {
  const user = await requireUser();
  const pf = await loadPortfolio(user.id);
  const assetOf = new Map(pf.assets.map((a) => [a.id, a]));
  const category = (id: string | undefined) => (id && assetOf.get(id) ? ASSET_RULES[assetOf.get(id)!.type].category : "");
  const nameOf = (id: string) => assetOf.get(id)?.name ?? "Unknown";

  type Row = (string | number | null)[];
  const rows: { date: string; cells: Row }[] = [];

  for (const l of pf.lots) {
    rows.push({
      date: l.buyDate,
      cells: [l.buyDate, l.eventId ? "Bonus shares" : "Buy", nameOf(l.assetId), category(l.assetId), l.platform ?? "", csvQty(l.qty), csvMoney(l.unitPrice), csvMoney(l.fees), csvMoney(l.qty * l.unitPrice), ""],
    });
  }
  for (const s of pf.saleEvents) {
    rows.push({
      date: s.date,
      cells: [
        s.date,
        s.buyback ? "Buyback" : "Sell",
        nameOf(s.assetId),
        category(s.assetId),
        (s.platforms ?? []).join("; "),
        csvQty(s.qty),
        csvMoney(s.price),
        csvMoney(s.fees),
        csvMoney(s.qty * s.price),
        s.buyback && s.tenderedQty ? `${s.qty} of ${s.tenderedQty} tendered shares accepted` : "",
      ],
    });
  }
  for (const m of pf.miscEvents) {
    rows.push({ date: m.date, cells: [m.date, "Misc", "Misc profit / loss", ASSET_RULES[m.assetType].category, "", null, null, csvMoney(m.brokerage), csvMoney(m.amount), m.note] });
  }
  for (const a of pf.actions) {
    const base = [a.date, a.type === "split" ? "Split" : a.type === "bonus" ? "Bonus" : "Dividend", nameOf(a.assetId), category(a.assetId), ""];
    if (a.type === "dividend") rows.push({ date: a.date, cells: [...base, null, null, null, csvMoney(a.amount), a.tds > 0 ? `TDS ${csvMoney(a.tds)}` : a.note] });
    else rows.push({ date: a.date, cells: [...base, null, null, null, null, `${a.ratioOld}:${a.ratioNew}${a.type === "split" ? ` (units factor today ${unitsAt(pf.actions, a.assetId, "9999-12-31")})` : ""}`] });
  }
  rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  const header = ["Date", "Type", "Name", "Category", "Platform", "Quantity", "Price", "Fees", "Amount", "Note"];
  const body = [header, ...rows.map((r) => r.cells)].map((r) => r.map(csvCell).join(",")).join("\n");
  return new Response(`\uFEFF${body}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="global-fin-all-data.csv"',
    },
  });
}
