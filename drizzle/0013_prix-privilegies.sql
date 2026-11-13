CREATE TABLE "privileged_groups" (
	"id" serial PRIMARY KEY NOT NULL,
	"shop_id" integer NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "privileged_prices" (
	"product_id" integer NOT NULL,
	"group_id" integer NOT NULL,
	"buy_price" integer NOT NULL,
	CONSTRAINT "privileged_prices_product_id_group_id_pk" PRIMARY KEY("product_id","group_id")
);
--> statement-breakpoint
ALTER TABLE "privileged_groups" ADD CONSTRAINT "privileged_groups_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "privileged_prices" ADD CONSTRAINT "privileged_prices_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "privileged_prices" ADD CONSTRAINT "privileged_prices_group_id_privileged_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."privileged_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "privileged_groups_shop_name_idx" ON "privileged_groups" USING btree ("shop_id","name");--> statement-breakpoint
CREATE INDEX "privileged_prices_group_idx" ON "privileged_prices" USING btree ("group_id");--> statement-breakpoint
-- The citizens of Estemarche become the comptoir's first privileged group,
-- with the citizens' prices set so far.
INSERT INTO "privileged_groups" ("shop_id", "name")
SELECT "id", 'Citoyens d''Estemarche' FROM "shops"
WHERE "id" = 1 OR "id" IN (SELECT "shop_id" FROM "products" WHERE "citizen_buy_price" IS NOT NULL);--> statement-breakpoint
INSERT INTO "privileged_prices" ("product_id", "group_id", "buy_price")
SELECT p."id", g."id", p."citizen_buy_price"
FROM "products" p JOIN "privileged_groups" g ON g."shop_id" = p."shop_id"
WHERE p."citizen_buy_price" IS NOT NULL;
