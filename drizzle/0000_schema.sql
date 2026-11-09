CREATE TYPE "public"."member_role" AS ENUM('gerant', 'employe', 'desactive');--> statement-breakpoint
CREATE TYPE "public"."product_category" AS ENUM('peau', 'cuir', 'viande', 'ressource', 'autre');--> statement-breakpoint
CREATE TABLE "members" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "member_role" DEFAULT 'employe' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category" "product_category" NOT NULL,
	"unit" text DEFAULT 'pièce' NOT NULL,
	"stock" integer DEFAULT 0 NOT NULL,
	"buy_price" integer,
	"buy_qty" integer DEFAULT 1 NOT NULL,
	"sell_price" integer,
	"sell_qty" integer DEFAULT 1 NOT NULL,
	"bulk_min" integer,
	"bulk_price" integer,
	"bulk_qty" integer DEFAULT 1 NOT NULL,
	"hides_per_batch" integer,
	"leather_per_batch" integer,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_stock_positive" CHECK ("products"."stock" >= 0),
	CONSTRAINT "products_quantities_positive" CHECK ("products"."buy_qty" > 0 and "products"."sell_qty" > 0 and "products"."bulk_qty" > 0)
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_movements" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"delta" integer NOT NULL,
	"stock_after" integer NOT NULL,
	"member_id" integer NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "members_username_idx" ON "members" USING btree ("username");--> statement-breakpoint
CREATE UNIQUE INDEX "products_name_idx" ON "products" USING btree ("name");