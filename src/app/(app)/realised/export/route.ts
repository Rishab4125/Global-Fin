import { todayIso } from "@/domain/dates";
import { requireUser } from "@/features/auth/session";
import { loadPortfolio } from "@/features/portfolio/data";
import { realisedView } from "@/features/reports/realisedFilter";
import { toCsv } from "@/features/reports/summary";

/** Exports exactly what the Realised gains page shows for the same period and filters. */
export async function GET(req: Request) {
  const user = await requireUser();
  const sp = new URL(req.url).searchParams;
  const pf = await loadPortfolio(user.id);
  const view = realisedView(
    pf,
    {
      period: sp.get("period") ?? undefined,
      from: sp.get("from") ?? undefined,
      to: sp.get("to") ?? undefined,
      ty: sp.get("ty") ?? undefined,
      term: sp.get("term") ?? undefined,
      sign: sp.get("sign") ?? undefined,
      pf: sp.get("pf") ?? undefined,
    },
    todayIso(),
  );
  const rows = [...view.rows].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  // The period was validated by resolvePeriod, so it is safe to use in the file name.
  const { period } = view;
  const label = period.value === "custom" ? `${period.from}_to_${period.to}` : period.value.replace(":", "-");
  return new Response(`﻿${toCsv(rows)}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="realised-gains-${label}.csv"`,
    },
  });
}
