import postgres from "postgres";

/** Empties the test database and seeds the gérant used by the tests. */
export default async function globalSetup() {
  if (process.env.BASE_URL) return; // never touch a deployed database
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL est requis pour les tests e2e.");
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    const tables = await sql<{ tablename: string }[]>`
      select tablename from pg_tables
      where schemaname = 'public' and tablename <> '__drizzle_migrations'`;
    if (tables.length) {
      await sql.unsafe(
        `truncate ${tables.map((t) => `"${t.tablename}"`).join(", ")} restart identity cascade`,
      );
    }
    await sql`
      insert into members (discord_id, discord_name, name, role)
      values ('test-Lomone', 'Lomone', 'Lomone', 'gerant')`;
  } finally {
    await sql.end();
  }
}
