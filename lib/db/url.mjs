// Normalise a Postgres URL for postgres.js.
// Vercel's Supabase integration adds query parameters (e.g. `supa=...`)
// that Postgres would reject as unknown settings, so only sslmode is kept.
export function connectionOptions(rawUrl) {
  if (!rawUrl) {
    throw new Error(
      "Aucune URL de base de données (DATABASE_URL, POSTGRES_URL, ou PREVIEW_POSTGRES_URL sur une preview).",
    );
  }
  const url = new URL(rawUrl);
  const sslmode = url.searchParams.get("sslmode");
  url.search = "";
  const local = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  const ssl = sslmode === "disable" || (local && !sslmode) ? false : "require";
  return { url: url.toString(), ssl };
}

// Previews get their own Supabase database, connected in Vercel to the
// Preview environment only, with the prefix "PREVIEW". A preview never falls
// back to the production database, even though Vercel exposes it there too.
function onPreview(env) {
  return env.VERCEL_ENV === "preview";
}

export function databaseUrl(env = process.env) {
  if (env.DATABASE_URL) return env.DATABASE_URL;
  return onPreview(env) ? env.PREVIEW_POSTGRES_URL : env.POSTGRES_URL;
}

/** Same database as databaseUrl, through a direct connection when one is known. */
export function migrationUrl(env = process.env) {
  if (env.DATABASE_MIGRATION_URL) return env.DATABASE_MIGRATION_URL;
  if (env.DATABASE_URL) return env.DATABASE_URL;
  return onPreview(env)
    ? env.PREVIEW_POSTGRES_URL_NON_POOLING ?? env.PREVIEW_POSTGRES_URL
    : env.POSTGRES_URL_NON_POOLING ?? env.POSTGRES_URL;
}
