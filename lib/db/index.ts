import "server-only";
import postgres from "postgres";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "./schema";
import { connectionOptions, databaseUrl } from "./url.mjs";

declare global {
  var __comptoirDb: PostgresJsDatabase<typeof schema> | undefined;
}

/** Shared database client, created on first use. */
export function getDb() {
  if (!globalThis.__comptoirDb) {
    const { url, ssl } = connectionOptions(databaseUrl());
    // prepare: false is required by Supabase's transaction pooler.
    const client = postgres(url, { ssl, max: 5, prepare: false });
    globalThis.__comptoirDb = drizzle({ client, schema });
  }
  return globalThis.__comptoirDb;
}

export { schema };

/** True for a Postgres unique constraint violation (drizzle wraps the driver error). */
export function isUniqueViolation(error: unknown) {
  const e = error as { code?: string; cause?: { code?: string } };
  return e?.code === "23505" || e?.cause?.code === "23505";
}
