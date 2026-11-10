import "server-only";
import postgres from "postgres";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { sql, type AnyColumn } from "drizzle-orm";
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

/**
 * Orders a text column the French way: case and accents only break ties, so
 * "élan" sits with the e's instead of after "z".
 */
export function byName(column: AnyColumn) {
  return sql`${column} collate "fr-x-icu"`;
}
