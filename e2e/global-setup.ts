import postgres from "postgres";
import { hashPassword } from "../lib/auth/password";
import { GERANT } from "./helpers";

/** Resets the test database and seeds the gérant used by the tests. */
export default async function globalSetup() {
  if (process.env.BASE_URL) return; // never touch a deployed database
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL est requis pour les tests e2e.");
  // The tests wipe the database: only ever run them against a test one.
  if (!new URL(url).pathname.includes("test")) {
    throw new Error(`Les tests e2e vident la base : ${new URL(url).pathname} n'est pas une base de test.`);
  }
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    // The gérant is the super admin, as the first gérant of a real comptoir.
    // Members and everything they recorded go; the seeded price grid stays.
    await sql`truncate members restart identity cascade`;
    await sql`update products set stock = 0`;
    // Shops other than the first are made by the tests: they go with what they sell.
    await sql`delete from suppliers where shop_id <> 1`;
    await sql`delete from products where shop_id <> 1`;
    await sql`delete from privileged_groups where shop_id <> 1`;
    await sql`delete from product_categories where shop_id <> 1`;
    await sql`delete from settings where shop_id <> 1`;
    await sql`delete from shops where id <> 1`;
    await sql`
      with gerant as (
        insert into members (username, name, password_hash, role, super_admin)
        values (${GERANT.username}, ${GERANT.name}, ${await hashPassword(GERANT.password)}, 'gerant', true)
        returning id
      )
      insert into shop_members (shop_id, member_id, role) select 1, id, 'gerant' from gerant`;
  } finally {
    await sql.end();
  }
}
