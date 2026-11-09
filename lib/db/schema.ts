import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const memberRole = pgEnum("member_role", ["gerant", "employe", "desactive"]);

export const members = pgTable(
  "members",
  {
    id: serial("id").primaryKey(),
    // Sign-in name, stored in lower case.
    username: text("username").notNull(),
    // Name shown in the registers (RP name).
    name: text("name").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: memberRole("role").notNull().default("employe"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("members_username_idx").on(t.username)],
);

export type Member = typeof members.$inferSelect;
export type MemberRole = (typeof memberRole.enumValues)[number];

export const productCategory = pgEnum("product_category", [
  "peau",
  "cuir",
  "viande",
  "ressource",
  "autre",
]);

/**
 * A merchandise of the comptoir: its price grid and its stock.
 * Prices are in septims for a given number of units, e.g. "1 septim / 4 unités"
 * is buyPrice = 1, buyQty = 4.
 */
export const products = pgTable(
  "products",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    category: productCategory("category").notNull(),
    unit: text("unit").notNull().default("pièce"),
    stock: integer("stock").notNull().default(0),
    buyPrice: integer("buy_price"),
    buyQty: integer("buy_qty").notNull().default(1),
    sellPrice: integer("sell_price"),
    sellQty: integer("sell_qty").notNull().default(1),
    // Wholesale: from bulkMin units, bulkPrice septims per bulkQty units.
    bulkMin: integer("bulk_min"),
    bulkPrice: integer("bulk_price"),
    bulkQty: integer("bulk_qty").notNull().default(1),
    // Hides only: hidesPerBatch hides give leatherPerBatch leathers.
    hidesPerBatch: integer("hides_per_batch"),
    leatherPerBatch: integer("leather_per_batch"),
    archived: boolean("archived").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("products_name_idx").on(t.name),
    check("products_stock_positive", sql`${t.stock} >= 0`),
    check(
      "products_quantities_positive",
      sql`${t.buyQty} > 0 and ${t.sellQty} > 0 and ${t.bulkQty} > 0`,
    ),
  ],
);

export const stockMovements = pgTable("stock_movements", {
  id: serial("id").primaryKey(),
  productId: integer("product_id")
    .notNull()
    .references(() => products.id),
  delta: integer("delta").notNull(),
  stockAfter: integer("stock_after").notNull(),
  memberId: integer("member_id")
    .notNull()
    .references(() => members.id),
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Comptoir-wide numbers, such as the price the blacksmith pays for a leather. */
export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: integer("value").notNull(),
});

export type Product = typeof products.$inferSelect;
export type ProductCategory = (typeof productCategory.enumValues)[number];
