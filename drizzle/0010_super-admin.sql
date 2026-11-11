ALTER TABLE "members" ADD COLUMN "super_admin" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_super_admin_gerant" CHECK (not "members"."super_admin" or "members"."role" = 'gerant');--> statement-breakpoint
-- The comptoir's owner, in prod.
UPDATE "members" SET "super_admin" = true, "role" = 'gerant' WHERE "username" = 'jesuisuncaillou';
