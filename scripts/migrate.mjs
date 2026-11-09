// Applies the SQL migrations in ./drizzle to the database.
import nextEnv from "@next/env";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { connectionOptions, migrationUrl } from "../lib/db/url.mjs";

nextEnv.loadEnvConfig(process.cwd());
const { url, ssl } = connectionOptions(migrationUrl());
const client = postgres(url, { ssl, max: 1, prepare: false, onnotice: () => {} });
try {
  await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
  console.log("Migrations appliquées.");
} finally {
  await client.end();
}
