// Fills a fresh preview database so it can be tried right away: Caillou's
// gérant account and a second gérant, some stock, privileged groups, a second shop (La Taverne du Port), a few announcements, the old app's suppliers, a customer (Roy) and
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

// A second gérant, with Lomone's password, to see from another gérant's seat
// that the super admin's account (Lomone, unless someone already was) cannot be
// changed. Never made super admin here.
const SECOND_GERANT = { username: "aela", name: "Aela" };

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

// The comptoir's privileged groups and their price for a leather (the usual one is 4).
const PRIVILEGED = [
  ["Citoyens d'Estemarche", 5],
  ["Compagnons", 6],
];

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
const CASH_NOTE = "Exemple de mouvement de caisse pas encore en caisse (preview)";
/** Cash movements waiting for the till: [kind, label, amount, counterparty]. */
const CASH_SAMPLES = [
  ["sortie", "Salaires", 40, "Faendal"],
  ["entree", "Apport du gérant", 150, null],
];

// A second shop, with a few goods of its own and a parchment.
const TAVERN = {
  name: "La Taverne du Port",
  slug: "taverne-du-port",
  products: [
    ["Hydromel Black-Briar", "autre", 24, 8],
    ["Ragoût de venaison", "viande", 10, 5],
    ["Pain de miel", "autre", 30, 2],
  ],
  announcement: {
    title: "Soirée des bardes",
    body: "Vendredi soir, hydromel à moitié prix pour qui chante.",
  },
};

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

// A customer: what he buys from us, [product name, septims, units]. Put back
// whenever he is missing, so a deleted Roy comes again on the next preview.
const CUSTOMER = {
  name: "Roy",
  place: "Vendeaume",
  notes: "Nous achète du cuir et le revend plus cher à Solitude",
  buys: [["Cuir", 5, 1], ["Venaison", 2, 1]],
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

    // The members migration only names the owner's prod account: Lomone becomes
    // super admin, unless someone already is.
    const [boss] = await tx`
      update members set super_admin = true
      where username = ${GERANT.username} and role = 'gerant'
        and not exists (select 1 from members where super_admin)
      returning id`;
    if (boss) console.log("Lomone est super admin.");

    const [second] = await tx`
      insert into members (username, name, password_hash, role)
      values (${SECOND_GERANT.username}, ${SECOND_GERANT.name}, ${GERANT.passwordHash}, 'gerant')
      on conflict (username) do nothing
      returning id`;
    console.log(second ? "Gérante Aela créée." : "Gérante Aela déjà présente.");

    const [{ id: memberId }] = await tx`select id from members where username = ${GERANT.username}`;
    // Both are gérants of the first shop (the comptoir); kept if already there.
    await tx`
      insert into shop_members (shop_id, member_id, role)
      select 1, id, 'gerant' from members where username in (${GERANT.username}, ${SECOND_GERANT.username})
      on conflict do nothing`;

    const [{ posted }] = await tx`select count(*)::int as posted from announcements where shop_id = 1`;
    if (posted === 0) {
      for (const [i, { title, body, pin }] of ANNOUNCEMENTS.entries()) {
        await tx`
          insert into announcements (shop_id, title, body, pin, member_id, created_at)
          values (1, ${title}, ${body}, ${pin}, ${memberId}, now() - ${`${ANNOUNCEMENTS.length - i} hours`}::interval)`;
      }
      console.log("Annonces d'exemple affichées.");
    }

    const [{ listed }] = await tx`select count(*)::int as listed from suppliers where shop_id = 1`;
    if (listed === 0) {
      for (const { name, place, notes, offers } of SUPPLIERS) {
        const [{ id }] = await tx`
          insert into suppliers (shop_id, name, place, notes) values (1, ${name}, ${place}, ${notes}) returning id`;
        for (const [product, price, qty] of offers) {
          // Only merchandise this database knows.
          await tx`
            insert into supplier_offers (supplier_id, product_id, price, qty)
            select ${id}, id, ${price}, ${qty} from products where shop_id = 1 and name = ${product}`;
        }
      }
      console.log("Fournisseurs d'exemple ajoutés.");
    }

    const [customer] = await tx`
      insert into suppliers (shop_id, name, place, notes)
      values (1, ${CUSTOMER.name}, ${CUSTOMER.place}, ${CUSTOMER.notes})
      on conflict (shop_id, name) do nothing
      returning id`;
    if (customer) {
      for (const [product, price, qty] of CUSTOMER.buys) {
        await tx`
          insert into supplier_offers (supplier_id, product_id, price, qty, side)
          select ${customer.id}, id, ${price}, ${qty}, 'buys' from products where shop_id = 1 and name = ${product}`;
      }
      console.log("Client d'exemple Roy ajouté.");
    }

    const [{ moved }] = await tx`select count(*)::int as moved from stock_movements`;
    if (moved === 0) {
      for (const [name, quantity] of Object.entries(STOCK)) {
        const [product] = await tx`
          update products set stock = stock + ${quantity}
          where shop_id = 1 and name = ${name} returning id, stock`;
        if (!product) continue;
        await tx`
          insert into stock_movements (shop_id, product_id, delta, stock_after, member_id, reason)
          values (1, ${product.id}, ${quantity}, ${product.stock}, ${memberId}, 'Stock de départ (preview)')`;
      }
      console.log("Stock de départ ajouté.");
    }

    // Again on each build once every sample waiting for the till has been settled or cancelled.
    const [{ waiting }] = await tx`
      select count(*)::int as waiting from transactions
      where notes = ${SAMPLE_NOTE} and till_pending and cancelled_at is null`;
    if (waiting === 0) {
      // Each entry at its own instant; the lines of one entry share theirs.
      // Mirrors recordTransaction and moveStock (app/[boutique]/achat-vente/actions.ts,
      // lib/products.ts): follow them if they change.
      for (const [i, [kind, counterparty, pending, lines]] of SAMPLES.entries()) {
        const at = sql`now() - ${`${(SAMPLES.length - i) * 7} minutes`}::interval`;
        for (const [name, quantity, amount] of lines) {
          const delta = kind === "rachat" ? quantity : -quantity;
          const [product] = await tx`
            update products set stock = stock + ${delta}
            where shop_id = 1 and name = ${name} and stock + ${delta} >= 0 returning id, stock`;
          if (!product) continue;
          const [line] = await tx`
            insert into transactions (shop_id, kind, product_id, label, quantity, amount, counterparty, notes, till_pending, member_id, created_at)
            values (1, ${kind}, ${product.id}, ${name}, ${quantity}, ${amount}, ${counterparty}, ${SAMPLE_NOTE}, ${pending}, ${memberId}, ${at})
            returning id`;
          await tx`
            insert into stock_movements (shop_id, product_id, delta, stock_after, member_id, reason, transaction_id, created_at)
            values (1, ${product.id}, ${delta}, ${product.stock}, ${memberId},
              ${`${kind === "rachat" ? "Achat" : "Vente"} · ${counterparty}`}, ${line.id}, ${at})`;
        }
      }
      console.log("Achats et ventes groupés d'exemple ajoutés.");
    }

    // Privileged groups of the comptoir, both with a price on the leather, to
    // try a purchase at each group's price. Again once a group was removed.
    for (const [group, price] of PRIVILEGED) {
      const [made] = await tx`
        insert into privileged_groups (shop_id, name)
        select 1, ${group}
        where not exists (select 1 from privileged_groups where shop_id = 1 and name = ${group})
        returning id`;
      if (!made) continue;
      await tx`
        insert into privileged_prices (product_id, group_id, buy_price)
        select id, ${made.id}, ${price} from products where shop_id = 1 and name = 'Cuir'`;
      console.log(`Clients privilégiés « ${group} » ajoutés, avec un prix pour le cuir.`);
    }

    // A second shop, to see shops side by side: Aela is gérante of both, so
    // she chooses between them; Lomone, super admin, enters both.
    const [tavern] = await tx`
      insert into shops (name, slug) values (${TAVERN.name}, ${TAVERN.slug})
      on conflict (slug) do nothing
      returning id`;
    if (tavern) {
      await tx`
        insert into shop_members (shop_id, member_id, role)
        select ${tavern.id}, id, 'gerant' from members where username = ${SECOND_GERANT.username}`;
      for (const [name, category, stock, sell] of TAVERN.products) {
        await tx`
          insert into products (shop_id, name, category, stock, sell_price)
          values (${tavern.id}, ${name}, ${category}, ${stock}, ${sell})`;
      }
      const [{ id: aela }] = await tx`select id from members where username = ${SECOND_GERANT.username}`;
      await tx`
        insert into announcements (shop_id, title, body, pin, member_id)
        values (${tavern.id}, ${TAVERN.announcement.title}, ${TAVERN.announcement.body}, 'viande', ${aela})`;
      console.log("Boutique d'exemple « La Taverne du Port » créée.");
    }

    // Again on each build once both have been settled or cancelled. Mirrors recordCashLine (lib/transactions.ts).
    // The shop is named: the preview database, shared with other branches, may have lost shop_id's default.
    const [{ cashWaiting }] = await tx`
      select count(*)::int as "cashWaiting" from transactions
      where notes = ${CASH_NOTE} and till_pending and cancelled_at is null`;
    if (cashWaiting === 0) {
      for (const [kind, label, amount, counterparty] of CASH_SAMPLES) {
        await tx`
          insert into transactions (shop_id, kind, product_id, label, quantity, amount, counterparty, notes, till_pending, member_id)
          values (1, ${kind}, null, ${label}, 1, ${amount}, ${counterparty}, ${CASH_NOTE}, true, ${memberId})`;
      }
      console.log("Mouvements de caisse pas encore en caisse ajoutés.");
    }
  });
} finally {
  await sql.end();
}
