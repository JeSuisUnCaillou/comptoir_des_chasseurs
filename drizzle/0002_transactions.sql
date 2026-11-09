CREATE TYPE "public"."transaction_kind" AS ENUM('vente', 'rachat');--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" "transaction_kind" NOT NULL,
	"product_id" integer,
	"label" text NOT NULL,
	"quantity" integer NOT NULL,
	"amount" integer NOT NULL,
	"counterparty" text,
	"notes" text,
	"member_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cancelled_at" timestamp with time zone,
	"cancelled_by" integer,
	CONSTRAINT "transactions_quantity_positive" CHECK ("transactions"."quantity" > 0),
	CONSTRAINT "transactions_amount_positive" CHECK ("transactions"."amount" >= 0)
);
--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_cancelled_by_members_id_fk" FOREIGN KEY ("cancelled_by") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;