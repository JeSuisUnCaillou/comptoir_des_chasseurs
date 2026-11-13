CREATE TABLE "shop_invitations" (
	"id" serial PRIMARY KEY NOT NULL,
	"token" text NOT NULL,
	"shop_id" integer NOT NULL,
	"created_by" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"used_at" timestamp with time zone,
	"used_by" integer
);
--> statement-breakpoint
DROP INDEX "settings_shop_key_idx";--> statement-breakpoint
ALTER TABLE "announcements" ALTER COLUMN "shop_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "shop_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "settings" DROP CONSTRAINT "settings_pkey";--> statement-breakpoint
ALTER TABLE "settings" ALTER COLUMN "shop_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "stock_movements" ALTER COLUMN "shop_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "suppliers" ALTER COLUMN "shop_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "transactions" ALTER COLUMN "shop_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_shop_id_key_pk" PRIMARY KEY("shop_id","key");--> statement-breakpoint
ALTER TABLE "shop_invitations" ADD CONSTRAINT "shop_invitations_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_invitations" ADD CONSTRAINT "shop_invitations_created_by_members_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_invitations" ADD CONSTRAINT "shop_invitations_used_by_members_id_fk" FOREIGN KEY ("used_by") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "shop_invitations_token_idx" ON "shop_invitations" USING btree ("token");--> statement-breakpoint
-- Accounts created by the code of before shops while it was being replaced
-- have no shop: they join the first one, with the role they were given.
INSERT INTO "shop_members" ("shop_id", "member_id", "role", "created_at")
SELECT 1, "id", "role", "created_at" FROM "members" m
WHERE NOT EXISTS (SELECT 1 FROM "shop_members" s WHERE s."member_id" = m."id");
