-- Shops opened before setting up existed, still empty (no merchandise in
-- stock, no stock movement ever), are offered it too. The comptoir never is.
-- Rerunning it changes nothing more.
UPDATE "shops" SET "setup_pending" = true
WHERE "slug" <> 'le-comptoir-des-chasseurs'
  AND NOT EXISTS (SELECT 1 FROM "products" p WHERE p."shop_id" = "shops"."id" AND p."stock" > 0)
  AND NOT EXISTS (SELECT 1 FROM "stock_movements" m WHERE m."shop_id" = "shops"."id");
