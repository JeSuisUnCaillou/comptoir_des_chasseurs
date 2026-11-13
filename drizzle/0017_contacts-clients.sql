-- IF NOT EXISTS: the previews' database already has the type and the column,
-- added when this migration was numbered 0014 and 0016.
DO $$ BEGIN
  CREATE TYPE "public"."offer_side" AS ENUM('sells', 'buys');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
ALTER TABLE "supplier_offers" ADD COLUMN IF NOT EXISTS "side" "offer_side" DEFAULT 'sells' NOT NULL;--> statement-breakpoint
-- Roy, noted as a supplier in the comptoir, buys our merchandise: he becomes a customer.
UPDATE "supplier_offers" SET "side" = 'buys'
WHERE "supplier_id" IN (SELECT "id" FROM "suppliers" WHERE "shop_id" = 1 AND "name" = 'Roy');
