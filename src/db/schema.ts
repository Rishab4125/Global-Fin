import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  date,
  index,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const money = (name: string) => numeric(name, { precision: 20, scale: 4 });
/** Quantities and unit prices: crypto needs 8 decimals. Wide enough for the 1e12 price cap. */
const precise = (name: string) => numeric(name, { precision: 24, scale: 8 });

export const assets = pgTable(
  "assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    type: text("type").notNull(),
    name: text("name").notNull(),
    isin: text("isin"),
    tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
    notes: text("notes").notNull().default(""),
    /** Optional category-specific fields (FD rate and maturity, bond coupon, folio, ...). */
    details: jsonb("details").notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("assets_user_idx").on(t.userId),
    uniqueIndex("assets_user_isin_uq").on(t.userId, t.isin).where(sql`${t.isin} is not null`),
  ],
);

/** Split, bonus and dividend events on a holding. Lots stay as entered; events adjust them on read. */
export const corporateActions = pgTable(
  "corporate_actions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    assetId: uuid("asset_id")
      .notNull()
      .references(() => assets.id, { onDelete: "cascade" }),
    /** split, bonus or dividend */
    type: text("type").notNull(),
    actionDate: date("action_date", { mode: "string" }).notNull(),
    /** New units per old unit: 1:5 split is ratioOld 1, ratioNew 5. A 1:1 bonus is 1 and 1. */
    ratioNew: numeric("ratio_new", { precision: 12, scale: 4 }).notNull().default("1"),
    ratioOld: numeric("ratio_old", { precision: 12, scale: 4 }).notNull().default("1"),
    amount: money("amount").notNull().default("0"),
    tds: money("tds").notNull().default("0"),
    note: text("note").notNull().default(""),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("actions_user_idx").on(t.userId), index("actions_asset_idx").on(t.assetId)],
);

export const buyLots = pgTable(
  "buy_lots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    assetId: uuid("asset_id")
      .notNull()
      .references(() => assets.id, { onDelete: "cascade" }),
    buyDate: date("buy_date", { mode: "string" }).notNull(),
    qty: precise("qty").notNull(),
    unitPrice: precise("unit_price").notNull(),
    fees: money("fees").notNull().default("0"),
    /** Set when a bonus event created this lot; reversing the event removes it. */
    eventId: uuid("event_id").references((): AnyPgColumn => corporateActions.id, { onDelete: "cascade" }),
    /** Where this purchase is held (Zerodha, HDFC Bank, ...). One holding can span several platforms. */
    platform: text("platform").notNull().default("Other"),
    source: text("source").notNull().default("manual"),
    brokerTradeId: text("broker_trade_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("lots_user_idx").on(t.userId),
    index("lots_asset_idx").on(t.assetId),
    uniqueIndex("lots_broker_trade_uq")
      .on(t.userId, t.source, t.brokerTradeId)
      .where(sql`${t.brokerTradeId} is not null`),
  ],
);

export const sales = pgTable(
  "sales",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    assetId: uuid("asset_id")
      .notNull()
      .references(() => assets.id, { onDelete: "cascade" }),
    sellDate: date("sell_date", { mode: "string" }).notNull(),
    qty: precise("qty").notNull(),
    price: precise("price").notNull(),
    fees: money("fees").notNull().default("0"),
    applyTax: boolean("apply_tax").notNull().default(true),
    exemptRedemption: boolean("exempt_redemption").notNull().default(false),
    isBuyback: boolean("is_buyback").notNull().default(false),
    /** Shares tendered in a buyback; `qty` is the accepted part that became this sale. */
    tenderedQty: precise("tendered_qty"),
    source: text("source").notNull().default("manual"),
    brokerTradeId: text("broker_trade_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("sales_user_idx").on(t.userId),
    uniqueIndex("sales_broker_trade_uq")
      .on(t.userId, t.source, t.brokerTradeId)
      .where(sql`${t.brokerTradeId} is not null`),
  ],
);

export const saleAllocations = pgTable(
  "sale_allocations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    saleId: uuid("sale_id")
      .notNull()
      .references(() => sales.id, { onDelete: "cascade" }),
    lotId: uuid("lot_id")
      .notNull()
      .references(() => buyLots.id, { onDelete: "restrict" }),
    qty: precise("qty").notNull(),
  },
  (t) => [index("alloc_sale_idx").on(t.saleId), index("alloc_lot_idx").on(t.lotId)],
);

export const miscEntries = pgTable(
  "misc_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    assetType: text("asset_type").notNull(),
    entryDate: date("entry_date", { mode: "string" }).notNull(),
    amount: money("amount").notNull(),
    taxAdjusted: boolean("tax_adjusted").notNull().default(false),
    term: text("term").notNull().default("STCG"),
    cost: money("cost").notNull().default("0"),
    brokerage: money("brokerage").notNull().default("0"),
    note: text("note").notNull().default(""),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("misc_user_idx").on(t.userId)],
);

export const brokerConnections = pgTable(
  "broker_connections",
  {
    userId: text("user_id").notNull(),
    broker: text("broker").notNull(),
    apiKey: text("api_key"),
    apiSecretEnc: text("api_secret_enc"),
    accessTokenEnc: text("access_token_enc"),
    tokenExpiresAt: timestamp("token_expires_at"),
    lastSyncAt: timestamp("last_sync_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.broker] })],
);

/** Platforms the user added beyond the built-in ones. */
export const userPlatforms = pgTable(
  "user_platforms",
  {
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    /** broker, bank or self */
    kind: text("kind").notNull().default("broker"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.name] })],
);

export const userSettings = pgTable("user_settings", {
  userId: text("user_id").primaryKey(),
  slabRate: numeric("slab_rate", { precision: 5, scale: 4 }).notNull().default("0.3"),
});
