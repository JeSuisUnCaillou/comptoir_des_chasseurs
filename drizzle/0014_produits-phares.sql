ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "featured_at" timestamp with time zone;--> statement-breakpoint
-- IF NOT EXISTS: the shared preview database already has the column, added when
-- this migration was numbered 0012, then 0013.
-- Each shop keeps the product it already put forward: the one it chose, or else
-- its leather, as the Tarifs page showed until now.
UPDATE "products" p SET "featured_at" = now()
WHERE NOT p."archived" AND (
  p."id" IN (SELECT s."value" FROM "settings" s WHERE s."key" = 'produit_phare' AND s."shop_id" = p."shop_id")
  OR (
    p."id" = (
      SELECT c."id" FROM "products" c
      WHERE c."shop_id" = p."shop_id" AND c."category" = 'cuir' AND NOT c."archived"
      ORDER BY c."name", c."id" LIMIT 1
    )
    AND NOT EXISTS (
      SELECT 1 FROM "settings" s JOIN "products" f ON f."id" = s."value" AND f."shop_id" = s."shop_id" AND NOT f."archived"
      WHERE s."key" = 'produit_phare' AND s."shop_id" = p."shop_id"
    )
  )
);
