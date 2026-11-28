ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "contract_id" integer;--> statement-breakpoint
-- A first version of this migration, run on the previews' database, had a foreign key.
ALTER TABLE "transactions" DROP CONSTRAINT IF EXISTS "transactions_contract_id_contracts_id_fk";--> statement-breakpoint
-- The sales of contracts delivered today: every line of the entry their delivery line opens.
UPDATE "transactions" AS t SET "contract_id" = c."id"
FROM "contracts" AS c
JOIN "transactions" AS d ON d."id" = c."delivery_line_id"
WHERE t."contract_id" IS NULL
  AND (t."shop_id", t."member_id", t."kind", t."created_at") = (d."shop_id", d."member_id", d."kind", d."created_at");
