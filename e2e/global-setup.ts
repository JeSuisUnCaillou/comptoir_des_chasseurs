import postgres from "postgres";
import { hashPassword } from "../lib/auth/password";
import { GERANT } from "./helpers";

/** Resets the test database and seeds the gérant used by the tests. */
export default async function globalSetup() {
  if (process.env.BASE_URL) return; // never touch a deployed database
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL est requis pour les tests e2e.");
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    // Members and everything they recorded go; the seeded price grid stays.
    await sql`truncate members restart identity cascade`;
    await sql`update products set stock = 0`;
    await sql`
      insert into members (username, name, password_hash, role)
      values (${GERANT.username}, ${GERANT.name}, ${await hashPassword(GERANT.password)}, 'gerant')`;
  } finally {
    await sql.end();
  }
}
