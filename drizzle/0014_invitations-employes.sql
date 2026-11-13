ALTER TABLE "shop_invitations" ADD COLUMN IF NOT EXISTS "role" "member_role" DEFAULT 'gerant' NOT NULL;--> statement-breakpoint
ALTER TABLE "shop_invitations" ADD COLUMN IF NOT EXISTS "name" text;