import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const memberRole = pgEnum("member_role", ["gerant", "employe", "desactive"]);

/**
 * A shop hosted by the app, such as "Le Comptoir Des Chasseurs": its own
 * merchandises, register, board and suppliers, and its own members.
 */
export const shops = pgTable(
  "shops",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    // Its address in the app: /<slug>/…
    slug: text("slug").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("shops_slug_idx").on(t.slug)],
);

export type Shop = typeof shops.$inferSelect;

/**
 * A link the super admin gives someone to become gérant of a shop made for
 * them: /invitation/<token>, used once.
 */
export const shopInvitations = pgTable(
  "shop_invitations",
  {
    id: serial("id").primaryKey(),
    token: text("token").notNull(),
    shopId: integer("shop_id")
      .notNull()
      .references(() => shops.id),
    createdBy: integer("created_by")
      .notNull()
      .references(() => members.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    usedBy: integer("used_by").references(() => members.id),
  },
  (t) => [uniqueIndex("shop_invitations_token_idx").on(t.token)],
);

/** Every shop's data belongs to one shop, which every write names. */
function shopColumn() {
  return integer("shop_id")
    .notNull()
    .references(() => shops.id);
}

export const members = pgTable(
  "members",
  {
    id: serial("id").primaryKey(),
    // Sign-in name, stored in lower case.
    username: text("username").notNull(),
    // Name shown in the registers (RP name).
    name: text("name").notNull(),
    passwordHash: text("password_hash").notNull(),
    // Replaced by the role in each shop (shopMembers.role): no longer read,
    // dropped by a later migration.
    role: memberRole("role").notNull().default("employe"),
    // The comptoir's owner: always a gérant, and nobody else can change their
    // account (name, role, password).
    superAdmin: boolean("super_admin").notNull().default(false),
    // The Discord account the member linked themself, to sign in with it.
    discordId: text("discord_id"),
    // Its Discord name when it was linked, shown on their account page.
    discordName: text("discord_name"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("members_username_idx").on(t.username),
    // A Discord account opens one member's account only.
    uniqueIndex("members_discord_id_idx").on(t.discordId),
    // The super admin has every right, always: they stay a gérant.
    check("members_super_admin_gerant", sql`not ${t.superAdmin} or ${t.role} = 'gerant'`),
  ],
);

export type Member = typeof members.$inferSelect;
export type MemberRole = (typeof memberRole.enumValues)[number];

/** Who may enter a shop, and as what. One account can belong to several shops. */
export const shopMembers = pgTable(
  "shop_members",
  {
    shopId: integer("shop_id")
      .notNull()
      .references(() => shops.id),
    memberId: integer("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    role: memberRole("role").notNull().default("employe"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.shopId, t.memberId] }),
    index("shop_members_member_idx").on(t.memberId),
  ],
);

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
    shopId: shopColumn(),
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
    uniqueIndex("products_shop_name_idx").on(t.shopId, t.name),
    check("products_stock_positive", sql`${t.stock} >= 0`),
    check(
      "products_quantities_positive",
      sql`${t.buyQty} > 0 and ${t.sellQty} > 0 and ${t.bulkQty} > 0`,
    ),
  ],
);

export const stockMovements = pgTable("stock_movements", {
  id: serial("id").primaryKey(),
  shopId: shopColumn(),
  productId: integer("product_id")
    .notNull()
    .references(() => products.id),
  delta: integer("delta").notNull(),
  stockAfter: integer("stock_after").notNull(),
  memberId: integer("member_id")
    .notNull()
    .references(() => members.id),
  reason: text("reason").notNull(),
  // The register line that moved the stock (a sale, a buyback or its
  // cancellation). Null for a movement made by hand on the Inventaire.
  transactionId: integer("transaction_id").references(() => transactions.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** A shop's numbers, such as the price the blacksmith pays for a leather. */
export const settings = pgTable(
  "settings",
  {
    key: text("key").notNull(),
    shopId: shopColumn(),
    value: integer("value").notNull(),
  },
  (t) => [primaryKey({ columns: [t.shopId, t.key] })],
);

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
    shopId: shopColumn(),
    kind: transactionKind("kind").notNull(),
    productId: integer("product_id").references(() => products.id),
    // Product name at the time, or free text ("Salaires", ...).
    label: text("label").notNull(),
    quantity: integer("quantity").notNull(),
    amount: integer("amount").notNull(),
    counterparty: text("counterparty"),
    notes: text("notes"),
    // A sale or buyback whose septims the member has not yet put in or taken
    // from the till: it does not count in the till until then.
    tillPending: boolean("till_pending").notNull().default(false),
    memberId: integer("member_id")
      .notNull()
      .references(() => members.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelledBy: integer("cancelled_by").references(() => members.id),
  },
  (t) => [
    index("transactions_shop_created_at_idx").on(t.shopId, t.createdAt),
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
    shopId: shopColumn(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    // What holds the parchment on the board.
    pin: announcementPin("pin").notNull().default("couteau"),
    memberId: integer("member_id")
      .notNull()
      .references(() => members.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("announcements_shop_created_at_idx").on(t.shopId, t.createdAt)],
);

export type Announcement = typeof announcements.$inferSelect;
export type AnnouncementPin = (typeof announcementPin.enumValues)[number];

/** Someone the comptoir buys from: where to find them and what they sell. */
export const suppliers = pgTable(
  "suppliers",
  {
    id: serial("id").primaryKey(),
    shopId: shopColumn(),
    name: text("name").notNull(),
    // Where to find them ("Vendeaume").
    place: text("place").notNull().default(""),
    // Free note, such as who they represent.
    notes: text("notes").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("suppliers_shop_name_idx").on(t.shopId, t.name)],
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
