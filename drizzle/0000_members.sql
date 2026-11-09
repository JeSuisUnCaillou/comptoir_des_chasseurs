CREATE TYPE "public"."member_role" AS ENUM('gerant', 'employe', 'en_attente', 'refuse');--> statement-breakpoint
CREATE TABLE "members" (
	"id" serial PRIMARY KEY NOT NULL,
	"discord_id" text NOT NULL,
	"discord_name" text NOT NULL,
	"name" text NOT NULL,
	"role" "member_role" DEFAULT 'en_attente' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "members_discord_id_idx" ON "members" USING btree ("discord_id");