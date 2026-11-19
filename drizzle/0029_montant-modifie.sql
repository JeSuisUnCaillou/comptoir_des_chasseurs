ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "edited_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "edited_by" integer;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "transactions" ADD CONSTRAINT "transactions_edited_by_members_id_fk" FOREIGN KEY ("edited_by") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
