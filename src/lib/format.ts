const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

const inrWhole = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const qtyFmt = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 6 });

export const formatINR = (n: number) => inr.format(n);
export const formatINRWhole = (n: number) => inrWhole.format(n);
export const formatQty = (n: number) => qtyFmt.format(n);

export function formatDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export const gainClass = (n: number) => (n > 0 ? "text-gain" : n < 0 ? "text-loss" : "text-muted");
