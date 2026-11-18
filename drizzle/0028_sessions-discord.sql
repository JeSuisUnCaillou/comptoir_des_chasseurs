ALTER TABLE "members" ADD COLUMN IF NOT EXISTS "session_epoch" integer DEFAULT 0 NOT NULL;
