CREATE TYPE "public"."offer_side" AS ENUM('sells', 'buys');--> statement-breakpoint
ALTER TABLE "supplier_offers" ADD COLUMN "side" "offer_side" DEFAULT 'sells' NOT NULL;--> statement-breakpoint
-- Roy, noted as a supplier in the comptoir, buys our merchandise: he becomes a customer.
UPDATE "supplier_offers" SET "side" = 'buys'
WHERE "supplier_id" IN (SELECT "id" FROM "suppliers" WHERE "shop_id" = 1 AND "name" = 'Roy');
