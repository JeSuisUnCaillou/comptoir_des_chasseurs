CREATE TABLE "product_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"shop_id" integer NOT NULL,
	"name" text NOT NULL,
	"hides" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "category" SET DEFAULT 'autre';--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "category_id" integer;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "leather" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "product_categories_shop_name_idx" ON "product_categories" USING btree ("shop_id","name");--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_product_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."product_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- The comptoir keeps the categories of its Tarifs grids, in their order, and
-- gets « Composants alchimiques » (Caillou, 2026-11-13). Its leather goes with
-- the other resources, as on the Tarifs page, but stays marked as the leather.
INSERT INTO "product_categories" ("shop_id", "name", "hides")
SELECT s."id", c."name", c."hides" FROM "shops" s
CROSS JOIN (VALUES (1, 'Peaux', true), (2, 'Viandes et venaison', false), (3, 'Autres ressources', false), (4, 'Composants alchimiques', false)) AS c("rank", "name", "hides")
WHERE s."slug" = 'le-comptoir-des-chasseurs'
ORDER BY c."rank";--> statement-breakpoint
-- Every other shop starts with one category, which holds all it sells.
INSERT INTO "product_categories" ("shop_id", "name")
SELECT "id", 'Autres marchandises' FROM "shops" WHERE "slug" <> 'le-comptoir-des-chasseurs';--> statement-breakpoint
UPDATE "products" p SET
  "leather" = (p."category" = 'cuir'),
  "category_id" = (
    SELECT c."id" FROM "product_categories" c
    WHERE c."shop_id" = p."shop_id"
      AND c."name" IN (
        CASE p."category" WHEN 'peau' THEN 'Peaux' WHEN 'viande' THEN 'Viandes et venaison' ELSE 'Autres ressources' END,
        'Autres marchandises'
      )
  );--> statement-breakpoint
UPDATE "products" p SET "category_id" = c."id"
FROM "product_categories" c
WHERE c."shop_id" = p."shop_id" AND c."name" = 'Composants alchimiques'
  AND lower(p."name") IN ('oeil de smilodon', 'œil de smilodon', 'yeux de smilodon');--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "category_id" SET NOT NULL;--> statement-breakpoint
-- While this migration runs on a deployment, the code still in production
-- creates merchandises with the old category alone: give them one of the
-- shop's categories (hides for a hide, else its other goods). Dropped
-- with products.category (issue #184).
CREATE FUNCTION "products_fill_category"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."category_id" IS NULL THEN
    NEW."category_id" := (
      SELECT c."id" FROM "product_categories" c
      WHERE c."shop_id" = NEW."shop_id"
      ORDER BY (c."hides" = (NEW."category" = 'peau')) DESC,
        (c."name" IN ('Autres ressources', 'Autres marchandises')) DESC, c."id"
      LIMIT 1
    );
    NEW."leather" := (NEW."category" = 'cuir');
  END IF;
  RETURN NEW;
END $$;--> statement-breakpoint
CREATE TRIGGER "products_fill_category" BEFORE INSERT ON "products"
FOR EACH ROW EXECUTE FUNCTION "products_fill_category"();
