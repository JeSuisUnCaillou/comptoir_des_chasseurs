-- IF NOT EXISTS: the shared preview database got these from earlier
-- numberings of this migration (0012 to 0014) on this branch.
ALTER TABLE "members" ADD COLUMN IF NOT EXISTS "discord_id" text;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN IF NOT EXISTS "discord_name" text;--> statement-breakpoint
ALTER TABLE "shop_invitations" ADD COLUMN IF NOT EXISTS "role" "member_role" DEFAULT 'gerant' NOT NULL;--> statement-breakpoint
ALTER TABLE "shop_invitations" ADD COLUMN IF NOT EXISTS "name" text;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "members_discord_id_idx" ON "members" USING btree ("discord_id");