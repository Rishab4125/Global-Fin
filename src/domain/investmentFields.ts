// What the Add-investment form asks for, by type (PRD section 3). Required fields are few; the rest is optional and
// can be filled in later. Values the tax engine does not need are kept with the holding as plain details.
import { decimalsMessage, placesOf } from "./limits";
import { ASSET_RULES, ASSET_TYPE_IDS, CATEGORIES, type AssetTypeId, type Category } from "./taxRules";
import { cleanNumeric } from "../lib/numeric";

export interface FieldDef {
  key: string;
  label: string;
  kind: "text" | "select" | "number" | "date";
  required?: boolean;
  options?: string[];
  /** Number fields: most decimals allowed. */
  decimals?: number;
  min?: number;
  max?: number;
  /** Date fields: must fall after the purchase date. */
  afterPurchase?: boolean;
  hint?: string;
  placeholder?: string;
}

const EXCHANGE: FieldDef = { key: "exchange", label: "Exchange", kind: "select", required: true, options: ["NSE", "BSE"] };
const ISIN: FieldDef = {
  key: "isin",
  label: "ISIN",
  kind: "text",
  placeholder: "INE002A01018",
  hint: "Optional. Lets imports and sync find this holding.",
};

/** Fields asked for each type, beyond the common ones (name, platform, date, quantity, price, fees). */
export const TYPE_FIELDS: Partial<Record<AssetTypeId, FieldDef[]>> = {
  equity: [EXCHANGE, ISIN],
  gold_etf: [EXCHANGE, ISIN],
  equity_mf: [
    { key: "plan", label: "Plan", kind: "select", required: true, options: ["Direct", "Regular"] },
    { key: "option", label: "Option", kind: "select", required: true, options: ["Growth", "IDCW"] },
    { key: "folio", label: "Folio number", kind: "text" },
  ],
  debt_mf: [
    { key: "plan", label: "Plan", kind: "select", required: true, options: ["Direct", "Regular"] },
    { key: "option", label: "Option", kind: "select", required: true, options: ["Growth", "IDCW"] },
    { key: "folio", label: "Folio number", kind: "text" },
  ],
  fd: [
    { key: "rate", label: "Interest rate (%)", kind: "number", required: true, decimals: 2, min: 0.01, max: 100, placeholder: "7.10" },
    { key: "maturity", label: "Maturity date", kind: "date", required: true, afterPurchase: true },
    { key: "compounding", label: "Compounding", kind: "select", options: ["Quarterly", "Monthly", "Half-yearly", "Yearly", "At maturity"] },
  ],
  rd: [
    { key: "rate", label: "Interest rate (%)", kind: "number", required: true, decimals: 2, min: 0.01, max: 100, placeholder: "6.80" },
    { key: "maturity", label: "Maturity date", kind: "date", required: true, afterPurchase: true },
  ],
  bond_listed: [
    { key: "faceValue", label: "Face value (₹)", kind: "number", required: true, decimals: 2, min: 0.01 },
    { key: "maturity", label: "Maturity date", kind: "date", required: true, afterPurchase: true },
    { key: "coupon", label: "Coupon rate (%)", kind: "number", decimals: 2, min: 0, max: 100 },
  ],
  bond_unlisted: [
    { key: "faceValue", label: "Face value (₹)", kind: "number", required: true, decimals: 2, min: 0.01 },
    { key: "maturity", label: "Maturity date", kind: "date", required: true, afterPurchase: true },
    { key: "coupon", label: "Coupon rate (%)", kind: "number", decimals: 2, min: 0, max: 100 },
  ],
  gold_physical: [
    { key: "metal", label: "Metal", kind: "select", required: true, options: ["Gold", "Silver", "Other"] },
    { key: "purity", label: "Purity", kind: "select", options: ["24K", "22K", "18K", "Silver 999", "Other"] },
    { key: "storage", label: "Stored at", kind: "text", placeholder: "Home locker, bank locker" },
  ],
  sgb: [
    { key: "series", label: "Series", kind: "text", placeholder: "2023-24 Series III" },
    { key: "maturity", label: "Maturity date", kind: "date", afterPurchase: true },
  ],
  land: [
    { key: "propertyType", label: "Property type", kind: "select", required: true, options: ["Land", "Flat", "House", "Commercial"] },
    { key: "location", label: "Location", kind: "text", required: true, placeholder: "Sector 5, Pune" },
  ],
  ppf_epf: [
    { key: "scheme", label: "Scheme", kind: "select", required: true, options: ["PPF", "EPF", "NPS", "SSY", "Post office"] },
  ],
};

/** Types held as a single amount rather than units: quantity is always 1. */
export const LUMP_SUM: ReadonlySet<AssetTypeId> = new Set<AssetTypeId>(["fd", "rd", "ppf_epf", "land"]);

export interface Labels {
  name: string;
  namePlaceholder: string;
  qty: string;
  price: string;
}

/** Wording of the common fields for a type, so each category reads naturally. */
export function labelsFor(type: AssetTypeId): Labels {
  const l = (name: string, namePlaceholder: string, qty: string, price: string): Labels => ({ name, namePlaceholder, qty, price });
  switch (type) {
    case "equity":
    case "gold_etf":
      return l("Symbol or name", "RELIANCE", "Quantity (shares)", "Price per share (₹)");
    case "equity_mf":
    case "debt_mf":
      return l("Scheme name", "Parag Parikh Flexi Cap Fund", "Units", "NAV per unit (₹)");
    case "fd":
      return l("Name", "HDFC Bank FD 7.10%", "Quantity", "Principal (₹)");
    case "rd":
      return l("Name", "SBI Recurring Deposit", "Quantity", "Amount invested (₹)");
    case "bond_listed":
    case "bond_unlisted":
      return l("Issuer or bond name", "REC 8.2% 2030", "Quantity (bonds)", "Price per bond (₹)");
    case "gold_physical":
      return l("Name", "Gold coin 24K", "Weight (grams)", "Price per gram (₹)");
    case "sgb":
      return l("Name", "SGB 2023-24 Series III", "Units (grams)", "Issue price per gram (₹)");
    case "land":
      return l("Name", "Plot 12, Sector 5", "Quantity", "Purchase price (₹)");
    case "crypto":
      return l("Coin", "BTC", "Quantity", "Price per coin (₹)");
    case "ppf_epf":
      return l("Name", "PPF", "Quantity", "Opening balance (₹)");
    default:
      return l("Name", "e.g. Art, collectible", "Quantity", "Price per unit (₹)");
  }
}

export interface TypeOption {
  id: AssetTypeId;
  /** Short sub-type name shown in the second dropdown. */
  subType: string;
}

/** The sub-types of each category, in the order the tax rules list them. */
export function typesByCategory(): Record<Category, TypeOption[]> {
  const out = Object.fromEntries(CATEGORIES.map((c) => [c, [] as TypeOption[]])) as Record<Category, TypeOption[]>;
  for (const id of ASSET_TYPE_IDS) out[ASSET_RULES[id].category].push({ id, subType: ASSET_RULES[id].subType });
  return out;
}

/** The kind of platform a category usually lives on, for platforms the user adds on the fly. */
export function platformKindFor(category: Category): "broker" | "bank" | "self" {
  if (category === "Fixed Deposits" || category === "Govt schemes") return "bank";
  if (category === "Metals" || category === "Real Estate" || category === "Other") return "self";
  return "broker";
}

const isRealDate = (s: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};

/**
 * Check the type-specific fields from the form. `raw` holds the submitted text by field key. Returns the details to
 * keep with the holding, or the first problem in plain words.
 */
export function validateDetails(
  type: AssetTypeId,
  raw: Record<string, string | undefined>,
  purchaseDate: string,
): { details: Record<string, string | number>; error?: undefined } | { error: string; details?: undefined } {
  const details: Record<string, string | number> = {};
  for (const f of TYPE_FIELDS[type] ?? []) {
    const text = (raw[f.key] ?? "").trim();
    if (!text) {
      if (f.required) return { error: `${f.label} is required` };
      continue;
    }
    if (f.kind === "select") {
      if (!f.options?.includes(text)) return { error: `${f.label}: pick one of the options` };
      details[f.key] = text;
    } else if (f.kind === "number") {
      const cleaned = String(cleanNumeric(text));
      const n = Number(cleaned);
      if (!Number.isFinite(n) || cleaned === "") return { error: `${f.label}: enter a valid number` };
      if (f.min !== undefined && n < f.min) return { error: `${f.label} must be at least ${f.min}` };
      if (f.max !== undefined && n > f.max) return { error: `${f.label} can't be more than ${f.max}` };
      if (f.decimals !== undefined && placesOf(n) > f.decimals) {
        return { error: `${f.label}: ${decimalsMessage(f.decimals).toLowerCase()}` };
      }
      details[f.key] = n;
    } else if (f.kind === "date") {
      if (!isRealDate(text)) return { error: `${f.label}: pick a valid date` };
      if (f.afterPurchase && text <= purchaseDate) return { error: `${f.label} must be after the purchase date` };
      details[f.key] = text;
    } else {
      if (text.length > 100) return { error: `${f.label} is too long` };
      if (f.key === "isin" && !/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(text.toUpperCase())) {
        return { error: "ISIN looks wrong. It has 12 characters, e.g. INE002A01018" };
      }
      details[f.key] = f.key === "isin" ? text.toUpperCase() : text;
    }
  }
  return { details };
}
