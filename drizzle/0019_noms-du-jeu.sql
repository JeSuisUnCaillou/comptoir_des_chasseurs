-- IF NOT EXISTS: the shared preview database may get it again under another number.
CREATE TABLE IF NOT EXISTS "product_aliases" (
	"shop_id" integer NOT NULL,
	"name" text NOT NULL,
	"product_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_aliases_shop_id_name_pk" PRIMARY KEY("shop_id","name"),
	CONSTRAINT "product_aliases_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE no action ON UPDATE no action,
	CONSTRAINT "product_aliases_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "product_aliases_product_idx" ON "product_aliases" USING btree ("product_id");
