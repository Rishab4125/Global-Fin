import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const money = (name: string) => numeric(name, { precision: 20, scale: 4 });

export const assets = pgTable(
  "assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    type: text("type").notNull(),
    name: text("name").notNull(),
    isin: text("isin"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("assets_user_idx").on(t.userId),
    uniqueIndex("assets_user_isin_uq").on(t.userId, t.isin).where(sql`${t.isin} is not null`),
  ],
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
    qty: money("qty").notNull(),
    unitPrice: money("unit_price").notNull(),
    fees: money("fees").notNull().default("0"),
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
    qty: money("qty").notNull(),
    price: money("price").notNull(),
    fees: money("fees").notNull().default("0"),
    applyTax: boolean("apply_tax").notNull().default(true),
    exemptRedemption: boolean("exempt_redemption").notNull().default(false),
    isBuyback: boolean("is_buyback").notNull().default(false),
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
    qty: money("qty").notNull(),
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

export const userSettings = pgTable("user_settings", {
  userId: text("user_id").primaryKey(),
  slabRate: numeric("slab_rate", { precision: 5, scale: 4 }).notNull().default("0.3"),
});
