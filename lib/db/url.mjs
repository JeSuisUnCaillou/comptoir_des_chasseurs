// Normalise a Postgres URL for postgres.js.
// Vercel's Supabase integration adds query parameters (e.g. `supa=...`)
// that Postgres would reject as unknown settings, so only sslmode is kept.
export function connectionOptions(rawUrl) {
  if (!rawUrl) {
    throw new Error("Aucune URL de base de données (DATABASE_URL ou POSTGRES_URL).");
  }
  const url = new URL(rawUrl);
  const sslmode = url.searchParams.get("sslmode");
  url.search = "";
  const local = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  const ssl = sslmode === "disable" || (local && !sslmode) ? false : "require";
  return { url: url.toString(), ssl };
}

// Previews get their own Supabase database, connected in Vercel to the
// Preview environment only, with the prefix "PREVIEW". Its variables win
// over the production database's, which Vercel also exposes to previews.
export function databaseUrl(env = process.env) {
  return env.DATABASE_URL ?? env.PREVIEW_POSTGRES_URL ?? env.POSTGRES_URL;
}

export function migrationUrl(env = process.env) {
  return (
    env.DATABASE_MIGRATION_URL ??
    env.PREVIEW_POSTGRES_URL_NON_POOLING ??
    env.PREVIEW_POSTGRES_URL ??
    env.POSTGRES_URL_NON_POOLING ??
    databaseUrl(env)
  );
}
