-- The second half of 0026 (issue #187): no code in production reads these
-- columns any more. Written to run again on the shared preview database.
DROP TRIGGER IF EXISTS "products_fill_category" ON "products";--> statement-breakpoint
DROP FUNCTION IF EXISTS "products_fill_category"();--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN IF EXISTS "category";--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN IF EXISTS "citizen_buy_price";--> statement-breakpoint
ALTER TABLE "members" DROP COLUMN IF EXISTS "role";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."product_category";
