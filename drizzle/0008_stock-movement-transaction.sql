ALTER TABLE "stock_movements" ADD COLUMN "transaction_id" integer;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- Ties the movements already written by a sale or a buyback to their line: both were inserted in the same database transaction, so they share their creation instant.
UPDATE "stock_movements" AS m SET "transaction_id" = t."id"
FROM "transactions" AS t
WHERE m."transaction_id" IS NULL
  AND m."reason" NOT LIKE 'Annulation %'
  AND t."product_id" = m."product_id"
  AND t."member_id" = m."member_id"
  AND t."created_at" = m."created_at"
  AND t."quantity" = abs(m."delta");--> statement-breakpoint
-- And the movements that put the stock back when a line was cancelled ("Annulation vente n°12").
UPDATE "stock_movements" AS m SET "transaction_id" = t."id"
FROM "transactions" AS t
WHERE m."transaction_id" IS NULL
  AND m."reason" = 'Annulation ' || t."kind" || ' n°' || t."id"
  AND t."product_id" = m."product_id";
