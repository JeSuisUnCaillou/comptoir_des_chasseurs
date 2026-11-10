CREATE TABLE "supplier_offers" (
	"id" serial PRIMARY KEY NOT NULL,
	"supplier_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"price" integer NOT NULL,
	"qty" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "supplier_offers_price_positive" CHECK ("supplier_offers"."price" >= 0),
	CONSTRAINT "supplier_offers_qty_positive" CHECK ("supplier_offers"."qty" > 0)
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"place" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "supplier_offers" ADD CONSTRAINT "supplier_offers_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_offers" ADD CONSTRAINT "supplier_offers_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "supplier_offers_supplier_product_idx" ON "supplier_offers" USING btree ("supplier_id","product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "suppliers_name_idx" ON "suppliers" USING btree ("name");