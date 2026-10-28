import type { CorporateAction } from "../../domain/corporateActions";
import { ASSET_RULES, type AssetTypeId } from "../../domain/taxRules";

export type Kind = "buy" | "sell" | "buyback" | "dividend" | "misc" | "event";

export const KIND_LABEL: Record<Kind, string> = {
  buy: "Buy",
  sell: "Sell",
  buyback: "Buyback",
  dividend: "Dividend",
  misc: "Misc P/L",
  event: "Event",
};

export const KIND_BADGE: Record<Kind, string> = {
  buy: "badge-gain",
  sell: "badge-warn",
  buyback: "badge-warn",
  dividend: "badge-gain",
  misc: "badge-muted",
  event: "badge-muted",
};

export interface FeedItem {
  key: string;
  id: string;
  kind: Kind;
  date: string;
  assetId?: string;
  name: string;
  typeLabel: string;
  category: string;
  platform: string;
  qty: number | null;
  price: number | null;
  fees: number;
  /** Money the entry moved: cost of a buy, proceeds of a sale or buyback, a dividend, a misc gain or loss. Zero for events. */
  amount: number;
  /** Cash that left (negative) or came in (positive) after fees. Zero for events. */
  cash: number;
  /** For events: what happened, e.g. "1:5 split". */
  detail?: string;
  note?: string;
}

export interface FeedInput {
  assets: { id: string; name: string; type: AssetTypeId }[];
  lots: { id: string; assetId: string; buyDate: string; qty: number; unitPrice: number; fees: number; platform?: string | null; eventId?: string | null }[];
  sales: { id: string; assetId: string; date: string; qty: number; price: number; fees: number; buyback?: boolean; platforms?: string[] }[];
  misc: { id: string; assetType: AssetTypeId; date: string; amount: number; brokerage: number; note: string }[];
  actions: CorporateAction[];
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** "1:5 split", "1:1 bonus". */
export function eventDetail(a: CorporateAction): string {
  return `${a.ratioOld}:${a.ratioNew} ${a.type}`;
}

/** Everything that happened, newest first. Bonus lots are left out because their event already shows. */
export function buildFeed(input: FeedInput): FeedItem[] {
  const asset = new Map(input.assets.map((a) => [a.id, a]));
  const base = (assetId: string | undefined) => {
    const a = assetId ? asset.get(assetId) : undefined;
    return {
      name: a?.name ?? "Unknown",
      typeLabel: a ? ASSET_RULES[a.type].label : "",
      category: a ? ASSET_RULES[a.type].category : "",
    };
  };

  const items: FeedItem[] = [
    ...input.lots
      .filter((l) => !l.eventId)
      .map((l): FeedItem => {
        const amount = r2(l.qty * l.unitPrice);
        return {
          key: `buy-${l.id}`, id: l.id, kind: "buy", date: l.buyDate, assetId: l.assetId, ...base(l.assetId),
          platform: l.platform ?? "Other", qty: l.qty, price: l.unitPrice, fees: l.fees, amount, cash: -r2(amount + l.fees),
        };
      }),
    ...input.sales.map((s): FeedItem => {
      const amount = r2(s.qty * s.price);
      return {
        key: `sell-${s.id}`, id: s.id, kind: s.buyback ? "buyback" : "sell", date: s.date, assetId: s.assetId, ...base(s.assetId),
        platform: s.platforms?.join(", ") || "Other", qty: s.qty, price: s.price, fees: s.fees, amount, cash: r2(amount - s.fees),
      };
    }),
    ...input.misc.map((m): FeedItem => ({
      key: `misc-${m.id}`, id: m.id, kind: "misc", date: m.date, name: "Misc profit / loss",
      typeLabel: ASSET_RULES[m.assetType].label, category: ASSET_RULES[m.assetType].category,
      platform: "–", qty: null, price: null, fees: m.brokerage, amount: m.amount, cash: r2(m.amount - m.brokerage), note: m.note,
    })),
    ...input.actions.map((a): FeedItem => {
      const dividend = a.type === "dividend";
      return {
        key: `event-${a.id}`, id: a.id, kind: dividend ? "dividend" : "event", date: a.date, assetId: a.assetId, ...base(a.assetId),
        platform: "–", qty: null, price: null, fees: 0, amount: dividend ? a.amount : 0, cash: dividend ? a.amount : 0,
        detail: dividend ? undefined : eventDetail(a), note: a.note,
      };
    }),
  ];
  // Newest first; on one day, buys before sales so a same-day round trip reads in the order it happened.
  const order: Record<Kind, number> = { buy: 0, event: 1, sell: 2, buyback: 2, dividend: 3, misc: 4 };
  return items.sort((a, b) => (a.date === b.date ? order[b.kind] - order[a.kind] : a.date < b.date ? 1 : -1));
}

export interface MonthGroup {
  /** "2025-04" */
  key: string;
  label: string;
  count: number;
  /** Cash in minus cash out for the month. */
  net: number;
  items: FeedItem[];
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function monthLabel(key: string): string {
  const [y, m] = key.split("-");
  return `${MONTHS[Number(m) - 1]} ${y}`;
}

/** Groups items (already in the order to show) by calendar month, keeping that order. */
export function groupByMonth(items: FeedItem[]): MonthGroup[] {
  const groups: MonthGroup[] = [];
  for (const it of items) {
    const key = it.date.slice(0, 7);
    let g = groups.find((x) => x.key === key);
    if (!g) {
      g = { key, label: monthLabel(key), count: 0, net: 0, items: [] };
      groups.push(g);
    }
    g.items.push(it);
    g.count += 1;
    g.net = r2(g.net + it.cash);
  }
  return groups;
}
