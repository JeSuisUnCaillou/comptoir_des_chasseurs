ALTER TABLE "members" ADD COLUMN "discord_id" text;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "discord_name" text;--> statement-breakpoint
CREATE UNIQUE INDEX "members_discord_id_idx" ON "members" USING btree ("discord_id");