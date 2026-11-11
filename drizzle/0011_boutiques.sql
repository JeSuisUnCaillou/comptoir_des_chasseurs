CREATE TABLE "shop_members" (
	"shop_id" integer NOT NULL,
	"member_id" integer NOT NULL,
	"role" "member_role" DEFAULT 'employe' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shop_members_shop_id_member_id_pk" PRIMARY KEY("shop_id","member_id")
);
--> statement-breakpoint
CREATE TABLE "shops" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- The comptoir becomes the first shop: every existing row goes to it (shop_id defaults to 1).
INSERT INTO "shops" ("id", "name", "slug") VALUES (1, 'Le Comptoir Des Chasseurs', 'le-comptoir-des-chasseurs');--> statement-breakpoint
SELECT setval(pg_get_serial_sequence('shops', 'id'), 1);--> statement-breakpoint
DROP INDEX "announcements_created_at_idx";--> statement-breakpoint
DROP INDEX "products_name_idx";--> statement-breakpoint
DROP INDEX "suppliers_name_idx";--> statement-breakpoint
ALTER TABLE "announcements" ADD COLUMN "shop_id" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "shop_id" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "shop_id" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD COLUMN "shop_id" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "shop_id" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "shop_id" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "shop_members" ADD CONSTRAINT "shop_members_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_members" ADD CONSTRAINT "shop_members_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "shop_members_member_idx" ON "shop_members" USING btree ("member_id");--> statement-breakpoint
CREATE UNIQUE INDEX "shops_slug_idx" ON "shops" USING btree ("slug");--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "announcements_shop_created_at_idx" ON "announcements" USING btree ("shop_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "products_shop_name_idx" ON "products" USING btree ("shop_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "settings_shop_key_idx" ON "settings" USING btree ("shop_id","key");--> statement-breakpoint
CREATE UNIQUE INDEX "suppliers_shop_name_idx" ON "suppliers" USING btree ("shop_id","name");--> statement-breakpoint
CREATE INDEX "transactions_shop_created_at_idx" ON "transactions" USING btree ("shop_id","created_at");--> statement-breakpoint
-- Every member keeps their role, now in the first shop.
INSERT INTO "shop_members" ("shop_id", "member_id", "role", "created_at") SELECT 1, "id", "role", "created_at" FROM "members";
