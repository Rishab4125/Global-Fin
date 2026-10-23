import { requireUser } from "@/features/auth/session";
import { loadPortfolio } from "@/features/portfolio/data";
import { toCsv } from "@/features/reports/summary";

export async function GET(req: Request) {
  const user = await requireUser();
  const fy = new URL(req.url).searchParams.get("fy");
  const pf = await loadPortfolio(user.id);
  const rows = pf.rows
    .filter((r) => !fy || fy === "all" || r.fy === fy)
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  return new Response(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="realised-gains-${fy || "all"}.csv"`,
    },
  });
}
