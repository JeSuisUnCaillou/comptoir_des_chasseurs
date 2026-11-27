ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "price" integer;--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "delivery_line_id" integer;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "contracts" ADD CONSTRAINT "contracts_delivery_line_id_transactions_id_fk" FOREIGN KEY ("delivery_line_id") REFERENCES "public"."transactions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "contracts" ADD CONSTRAINT "contracts_price_positive" CHECK ("contracts"."price" >= 0);
EXCEPTION WHEN duplicate_object THEN null;
END $$;
