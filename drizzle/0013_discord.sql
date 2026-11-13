-- IF NOT EXISTS: the shared preview database got these columns from an earlier
-- numbering of this migration (0012) before main took that number.
ALTER TABLE "members" ADD COLUMN IF NOT EXISTS "discord_id" text;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN IF NOT EXISTS "discord_name" text;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "members_discord_id_idx" ON "members" USING btree ("discord_id");