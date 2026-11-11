// Fills a fresh preview database so it can be tried right away: Caillou's
// gérant account, some stock, a few announcements, the old app's suppliers and
// purchases and sales of several lines, some waiting for the till. Runs on preview builds
// only, after the migrations, and only adds what is missing (it never
// overwrites anything).
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

// A few parchments for the board, oldest first.
const ANNOUNCEMENTS = [
  {
    title: "Contrat de la taverne",
    body: "À livrer chaque semaine si possible :\n\n100 venaison\n100 pattes de vasard\n50 viandes de chèvre",
    pin: "viande",
  },
  {
    title: "Infos",
    body: "Un Khajiit s'est proposé pour racheter régulièrement nos viandes. Voyez avec moi avant de lui vendre.",
    pin: "hache",
  },
  {
    title: "URGENT",
    body: "Commande de 700 défenses de horqueurs pour dimanche : chassez ces bêtes en priorité.",
    pin: "couteau",
  },
];

// Purchases and sales of several lines, some whose septims are not in the
// till yet, to see entries as blocks and try « … septims pris / déposés »:
// [kind, counterparty, waiting for the till, [product name, quantity, septims]].
const SAMPLES = [
  ["vente", "Jarl de Vendeaume", false, [["Flèches d'acier", 50, 25], ["Venaison", 10, 15]]],
  ["rachat", "Markir", false, [["Biche", 3, 6], ["Renard", 4, 4], ["Ours", 1, 5]]],
  ["vente", "Do'Dran", true, [["Cuir", 5, 25], ["Kit débutant", 1, 30]]],
  ["rachat", "Faendal", true, [["Cuir", 10, 30], ["Loup", 2, 8], ["Venaison", 20, 20]]],
  ["vente", "Taverne de la Jument pie", true, [["Venaison", 30, 45], ["Viande d'horqueur", 10, 15]]],
];
const SAMPLE_NOTE = "Exemple d'écriture groupée (preview)";

// The old app's suppliers, with what they sell: [product name, septims, units].
const SUPPLIERS = [
  {
    name: "Do'Dran",
    place: "Vendeaume",
    notes: "Représentant Kajitt",
    offers: [["Patte de vasard", 1, 6], ["Venaison", 1, 1], ["Viande d'horqueur", 1, 2], ["Viande de chèvre", 1, 2]],
  },
  {
    name: "Markir",
    place: "Blancherive",
    notes: "Représentant des Guerriers-Nés",
    offers: [["Biche", 2, 1], ["Smilodon", 3, 1], ["Venaison", 1, 1]],
  },
  {
    name: "Swennec Roche-Ebène",
    place: "Pierre de Shor",
    notes: "Famille Roche-Ebène",
    offers: [["Cuir", 3, 1], ["Venaison", 2, 1]],
  },
];

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

    const [{ id: memberId }] = await tx`select id from members where username = ${GERANT.username}`;

    const [{ posted }] = await tx`select count(*)::int as posted from announcements`;
    if (posted === 0) {
      for (const [i, { title, body, pin }] of ANNOUNCEMENTS.entries()) {
        await tx`
          insert into announcements (title, body, pin, member_id, created_at)
          values (${title}, ${body}, ${pin}, ${memberId}, now() - ${`${ANNOUNCEMENTS.length - i} hours`}::interval)`;
      }
      console.log("Annonces d'exemple affichées.");
    }

    const [{ listed }] = await tx`select count(*)::int as listed from suppliers`;
    if (listed === 0) {
      for (const { name, place, notes, offers } of SUPPLIERS) {
        const [{ id }] = await tx`
          insert into suppliers (name, place, notes) values (${name}, ${place}, ${notes}) returning id`;
        for (const [product, price, qty] of offers) {
          // Only merchandise this database knows.
          await tx`
            insert into supplier_offers (supplier_id, product_id, price, qty)
            select ${id}, id, ${price}, ${qty} from products where name = ${product}`;
        }
      }
      console.log("Fournisseurs d'exemple ajoutés.");
    }

    const [{ moved }] = await tx`select count(*)::int as moved from stock_movements`;
    if (moved === 0) {
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
    }

    // Again on each build once every sample waiting for the till has been settled or cancelled.
    const [{ waiting }] = await tx`
      select count(*)::int as waiting from transactions
      where notes = ${SAMPLE_NOTE} and till_pending and cancelled_at is null`;
    if (waiting === 0) {
      // Each entry at its own instant; the lines of one entry share theirs.
      // Mirrors recordTransaction and moveStock (app/(comptoir)/achat-vente/actions.ts,
      // lib/products.ts): follow them if they change.
      for (const [i, [kind, counterparty, pending, lines]] of SAMPLES.entries()) {
        const at = sql`now() - ${`${(SAMPLES.length - i) * 7} minutes`}::interval`;
        for (const [name, quantity, amount] of lines) {
          const delta = kind === "rachat" ? quantity : -quantity;
          const [product] = await tx`
            update products set stock = stock + ${delta}
            where name = ${name} and stock + ${delta} >= 0 returning id, stock`;
          if (!product) continue;
          const [line] = await tx`
            insert into transactions (kind, product_id, label, quantity, amount, counterparty, notes, till_pending, member_id, created_at)
            values (${kind}, ${product.id}, ${name}, ${quantity}, ${amount}, ${counterparty}, ${SAMPLE_NOTE}, ${pending}, ${memberId}, ${at})
            returning id`;
          await tx`
            insert into stock_movements (product_id, delta, stock_after, member_id, reason, transaction_id, created_at)
            values (${product.id}, ${delta}, ${product.stock}, ${memberId},
              ${`${kind === "rachat" ? "Achat" : "Vente"} · ${counterparty}`}, ${line.id}, ${at})`;
        }
      }
      console.log("Achats et ventes groupés d'exemple ajoutés.");
    }
  });
} finally {
  await sql.end();
}
