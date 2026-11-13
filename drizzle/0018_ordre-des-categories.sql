-- IF NOT EXISTS: the shared preview database may get it again under another number.
ALTER TABLE "product_categories" ADD COLUMN IF NOT EXISTS "position" integer DEFAULT 0 NOT NULL;
