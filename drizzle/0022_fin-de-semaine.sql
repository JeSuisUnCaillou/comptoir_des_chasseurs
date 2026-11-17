CREATE TABLE "week_ends" (
	"id" serial PRIMARY KEY NOT NULL,
	"shop_id" integer NOT NULL,
	"member_id" integer NOT NULL,
	"declared_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "week_ends" ADD CONSTRAINT "week_ends_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "week_ends" ADD CONSTRAINT "week_ends_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "week_ends_shop_declared_at_idx" ON "week_ends" USING btree ("shop_id","declared_at");