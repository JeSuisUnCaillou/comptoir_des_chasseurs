import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
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
    // Buyback price for citizens of Estemarche, for the same buyQty units.
    // Null: they get the usual buyPrice.
    citizenBuyPrice: integer("citizen_buy_price"),
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

export const transactionKind = pgEnum("transaction_kind", ["vente", "rachat", "entree", "sortie"]);

/**
 * A line of the register. A sale brings money into the till, a buyback takes
 * money out. When it names a product, its stock moves with it. "entree" and
 * "sortie" move money alone (wages, the gérant's deposits...): no product,
 * quantity 1, the label holds the reason.
 */
export const transactions = pgTable(
  "transactions",
  {
    id: serial("id").primaryKey(),
    kind: transactionKind("kind").notNull(),
    productId: integer("product_id").references(() => products.id),
    // Product name at the time, or free text ("Salaires", ...).
    label: text("label").notNull(),
    quantity: integer("quantity").notNull(),
    amount: integer("amount").notNull(),
    counterparty: text("counterparty"),
    notes: text("notes"),
    memberId: integer("member_id")
      .notNull()
      .references(() => members.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelledBy: integer("cancelled_by").references(() => members.id),
  },
  (t) => [
    check("transactions_quantity_positive", sql`${t.quantity} > 0`),
    check("transactions_amount_positive", sql`${t.amount} >= 0`),
  ],
);

export type Transaction = typeof transactions.$inferSelect;
export type TransactionKind = (typeof transactionKind.enumValues)[number];

export const announcementPin = pgEnum("announcement_pin", ["couteau", "hache", "viande"]);

/** A parchment pinned on the comptoir's board, for every member to read. */
export const announcements = pgTable(
  "announcements",
  {
    id: serial("id").primaryKey(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    // What holds the parchment on the board.
    pin: announcementPin("pin").notNull().default("couteau"),
    memberId: integer("member_id")
      .notNull()
      .references(() => members.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("announcements_created_at_idx").on(t.createdAt)],
);

export type Announcement = typeof announcements.$inferSelect;
export type AnnouncementPin = (typeof announcementPin.enumValues)[number];

/** Someone the comptoir buys from: where to find them and what they sell. */
export const suppliers = pgTable(
  "suppliers",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    // Where to find them ("Vendeaume").
    place: text("place").notNull().default(""),
    // Free note, such as who they represent.
    notes: text("notes").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("suppliers_name_idx").on(t.name)],
);

/** A merchandise a supplier sells: price septims for qty units. */
export const supplierOffers = pgTable(
  "supplier_offers",
  {
    id: serial("id").primaryKey(),
    supplierId: integer("supplier_id")
      .notNull()
      .references(() => suppliers.id, { onDelete: "cascade" }),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id),
    price: integer("price").notNull(),
    qty: integer("qty").notNull().default(1),
  },
  (t) => [
    uniqueIndex("supplier_offers_supplier_product_idx").on(t.supplierId, t.productId),
    check("supplier_offers_price_positive", sql`${t.price} >= 0`),
    check("supplier_offers_qty_positive", sql`${t.qty} > 0`),
  ],
);

export type Supplier = typeof suppliers.$inferSelect;
export type SupplierOffer = typeof supplierOffers.$inferSelect;
