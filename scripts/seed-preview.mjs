// Fills a fresh preview database so it can be tried right away: Caillou's
// gérant account and some stock. Runs on preview builds only, after the
// migrations, and only adds what is missing (it never overwrites anything).
//
// The password is stored as a scrypt hash only, never in clear.
import nextEnv from "@next/env";
import postgres from "postgres";
import { connectionOptions, migrationUrl } from "../lib/db/url.mjs";

nextEnv.loadEnvConfig(process.cwd());
if (process.env.VERCEL_ENV !== "preview") {
  console.log("Seed preview ignoré (pas une preview).");
  process.exit(0);
}

const GERANT = {
  username: "lomone",
  name: "Lomone",
  passwordHash:
    "scrypt$nCyAZPZdFcvX4ZcPobSYXA==$fRPqmmGDJi4EBj/yJGJfdxePeTqbFU2f/pcUhtczR+2wHaDZgGOqNy939utA/AH8KB+L2AbvUE+1WD3P5DPzRQ==",
};

// Starting stock, by product name.
const STOCK = {
  Biche: 12,
  Loup: 8,
  Ours: 3,
  Renard: 15,
  Cuir: 40,
  Venaison: 120,
  "Viande d'horqueur": 60,
  "Flèches d'acier": 220,
  "Kit débutant": 5,
};

const { url, ssl } = connectionOptions(migrationUrl());
const sql = postgres(url, { ssl, max: 1, prepare: false, onnotice: () => {} });
try {
  await sql.begin(async (tx) => {
    const [gerant] = await tx`
      insert into members (username, name, password_hash, role)
      values (${GERANT.username}, ${GERANT.name}, ${GERANT.passwordHash}, 'gerant')
      on conflict (username) do nothing
      returning id`;
    console.log(gerant ? "Gérant Lomone créé." : "Gérant Lomone déjà présent.");

    const [{ moved }] = await tx`select count(*)::int as moved from stock_movements`;
    if (moved > 0) return;
    const [{ id: memberId }] = await tx`select id from members where username = ${GERANT.username}`;
    for (const [name, quantity] of Object.entries(STOCK)) {
      const [product] = await tx`
        update products set stock = stock + ${quantity}
        where name = ${name} returning id, stock`;
      if (!product) continue;
      await tx`
        insert into stock_movements (product_id, delta, stock_after, member_id, reason)
        values (${product.id}, ${quantity}, ${product.stock}, ${memberId}, 'Stock de départ (preview)')`;
    }
    console.log("Stock de départ ajouté.");
  });
} finally {
  await sql.end();
}
