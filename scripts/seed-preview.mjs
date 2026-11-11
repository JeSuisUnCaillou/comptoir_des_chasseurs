// Fills a fresh preview database so it can be tried right away: Caillou's
// gérant account, some stock, a few announcements, the old app's suppliers and
// a purchase and a sale waiting for the till. Runs on preview builds
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

// One purchase and one sale of several lines whose septims are not in the
// till yet, to try « Septims pris / déposés » on a whole entry:
// [kind, counterparty, [product name, quantity, septims]].
const PENDING = [
  ["rachat", "Faendal", [["Cuir", 10, 30], ["Loup", 2, 8], ["Venaison", 20, 20]]],
  ["vente", "Taverne de la Jument pie", [["Venaison", 30, 45], ["Viande d'horqueur", 10, 15]]],
];
const PENDING_NOTE = "Exemple en attente de la caisse (preview)";

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

    const [{ waiting }] = await tx`select count(*)::int as waiting from transactions where notes = ${PENDING_NOTE}`;
    if (waiting === 0) {
      // Each entry at its own instant; the lines of one entry share theirs.
      // Mirrors recordTransaction and moveStock (app/(comptoir)/achat-vente/actions.ts,
      // lib/products.ts): follow them if they change.
      for (const [i, [kind, counterparty, lines]] of PENDING.entries()) {
        const ago = `${PENDING.length - i} minutes`;
        for (const [name, quantity, amount] of lines) {
          const delta = kind === "rachat" ? quantity : -quantity;
          const [product] = await tx`
            update products set stock = stock + ${delta}
            where name = ${name} and stock + ${delta} >= 0 returning id, stock`;
          if (!product) continue;
          const [line] = await tx`
            insert into transactions (kind, product_id, label, quantity, amount, counterparty, notes, till_pending, member_id, created_at)
            values (${kind}, ${product.id}, ${name}, ${quantity}, ${amount}, ${counterparty}, ${PENDING_NOTE}, true, ${memberId},
              date_trunc('minute', now()) - ${ago}::interval)
            returning id`;
          await tx`
            insert into stock_movements (product_id, delta, stock_after, member_id, reason, transaction_id, created_at)
            values (${product.id}, ${delta}, ${product.stock}, ${memberId},
              ${`${kind === "rachat" ? "Achat" : "Vente"} · ${counterparty}`}, ${line.id}, date_trunc('minute', now()) - ${ago}::interval)`;
        }
      }
      console.log("Achat et vente en attente de la caisse ajoutés.");
    }
  });
} finally {
  await sql.end();
}
