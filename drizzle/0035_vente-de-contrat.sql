ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "contract_id" integer;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transactions" ADD CONSTRAINT "transactions_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
-- The sales of contracts delivered today: every line of the entry their delivery line opens.
UPDATE "transactions" AS t SET "contract_id" = c."id"
FROM "contracts" AS c
JOIN "transactions" AS d ON d."id" = c."delivery_line_id"
WHERE t."contract_id" IS NULL
  AND (t."shop_id", t."member_id", t."kind", t."created_at") = (d."shop_id", d."member_id", d."kind", d."created_at");
