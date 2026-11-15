import { randomBytes } from "node:crypto";
// Fills a fresh preview database so it can be tried right away: Caillou's
// gérant account and a second gérant, some stock, privileged groups, a second shop (La Taverne du Port), a few announcements, the old app's suppliers, a customer (Roy), a contact created by a sale (Ulfgar) and
// purchases and sales of several lines, some waiting for the till. Runs on preview builds
// only, after the migrations, and only adds what is missing (it never
// overwrites anything).
//
// Once production was copied into it (scripts/preview/copy-prod.mjs), only the
// accounts are added. The accounts live in scripts/preview/accounts.mjs.
import nextEnv from "@next/env";
import postgres from "postgres";
import { connectionOptions, migrationUrl } from "../lib/db/url.mjs";
import { ensurePreviewAccounts, GERANT, holdsProdCopy, SECOND_GERANT } from "./preview/accounts.mjs";

nextEnv.loadEnvConfig(process.cwd());
if (process.env.VERCEL_ENV !== "preview") {
  console.log("Seed preview ignoré (pas une preview).");
  process.exit(0);
}

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

// Products put forward on top of the Tarifs, after the leather the migration
// keeps, to see several featured cards side by side.
const FEATURED = ["Venaison", "Flèches d'acier"];

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

// A second shop, with categories and goods of its own and a parchment.
const TAVERN = {
  name: "La Taverne du Port",
  slug: "taverne-du-port",
  categories: ["Boissons", "Plats"],
  products: [
    ["Hydromel Black-Briar", "Boissons", 24, 8],
    ["Ragoût de venaison", "Plats", 10, 5],
    ["Pain de miel", "Plats", 30, 2],
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

// A contact as a sale under an unknown name creates it.
const FROM_SALE = { name: "Ulfgar", notes: "Chasseur de Morthal, passe chaque semaine", buys: ["Venaison", 2, 1] };

const { url, ssl } = connectionOptions(migrationUrl());
const sql = postgres(url, { ssl, max: 1, prepare: false, onnotice: () => {} });
try {
  await sql.begin(async (tx) => {
    const memberId = await ensurePreviewAccounts(tx);

    // A copy of production (scripts/preview/copy-prod.mjs) is tried as it is:
    // no sample on top of the real data, only the accounts above.
    if (await holdsProdCopy(tx)) {
      console.log("Copie de la prod : pas d'exemples ajoutés.");
      return;
    }

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

    // Back when deleted, so the tag can always be seen.
    const [fromSale] = await tx`
      insert into suppliers (shop_id, name, notes, from_transaction)
      values (1, ${FROM_SALE.name}, ${FROM_SALE.notes}, true)
      on conflict (shop_id, name) do nothing
      returning id`;
    if (fromSale) console.log("Contact d'exemple Ulfgar, créé lors d'une transaction, ajouté.");
    // With what the sale gave him, unless he already has a merchandise.
    const [venison, price, qty] = FROM_SALE.buys;
    await tx`
      insert into supplier_offers (supplier_id, product_id, price, qty, side)
      select s.id, p.id, ${price}, ${qty}, 'buys'
      from suppliers s join products p on p.shop_id = s.shop_id and p.name = ${venison}
      where s.shop_id = 1 and s.name = ${FROM_SALE.name} and s.from_transaction
        and not exists (select 1 from supplier_offers o where o.supplier_id = s.id)`;

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

    // The comptoir's « Composants alchimiques » (migration 0016) with a
    // merchandise in it, again once it was emptied; nothing if it was deleted.
    const [alchemy] = await tx`
      select c.id from product_categories c
      where c.shop_id = 1 and c.name = 'Composants alchimiques'
        and not exists (select 1 from products p where p.category_id = c.id)`;
    if (alchemy) {
      await tx`
        insert into products (shop_id, name, category_id, unit, stock, buy_price, sell_price)
        values (1, 'Oeil de smilodon', ${alchemy.id}, 'œil', 3, 4, 7)
        on conflict (shop_id, name) do update set category_id = excluded.category_id`;
      console.log("Oeil de smilodon rangé dans les Composants alchimiques.");
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
      for (const name of TAVERN.categories) {
        await tx`insert into product_categories (shop_id, name) values (${tavern.id}, ${name})`;
      }
      for (const [name, category, stock, sell] of TAVERN.products) {
        await tx`
          insert into products (shop_id, name, category_id, stock, sell_price)
          select ${tavern.id}, ${name}, id, ${stock}, ${sell} from product_categories
          where shop_id = ${tavern.id} and name = ${category}`;
      }
      const [{ id: aela }] = await tx`select id from members where username = ${SECOND_GERANT.username}`;
      await tx`
        insert into announcements (shop_id, title, body, pin, member_id)
        values (${tavern.id}, ${TAVERN.announcement.title}, ${TAVERN.announcement.body}, 'viande', ${aela})`;
      console.log("Boutique d'exemple « La Taverne du Port » créée.");
    }

    // An employé and a deactivated account in the comptoir's Membres, to try
    // « Désactiver » and « Réactiver » (both reversible, so kept as they are).
    for (const [username, name, role] of [
      ["faendal", "Faendal", "employe"],
      ["sven", "Sven", "desactive"],
    ]) {
      const [added] = await tx`
        insert into members (username, name, password_hash, role)
        values (${username}, ${name}, ${GERANT.passwordHash}, ${role})
        on conflict (username) do nothing
        returning id`;
      if (added) {
        await tx`insert into shop_members (shop_id, member_id, role) values (1, ${added.id}, ${role})`;
        console.log(`Compte ${name} ajouté au comptoir.`);
      }
    }

    // An employé invitation link of the comptoir waiting in Membres, to try
    // « Entrer avec Discord ». Again on each build once it has been taken.
    const [{ invitations }] = await tx`
      select count(*)::int as invitations from shop_invitations
      where shop_id = 1 and role = 'employe' and used_at is null`;
    if (invitations === 0) {
      await tx`
        insert into shop_invitations (token, shop_id, created_by, role)
        values (${randomBytes(24).toString("base64url")}, 1, ${memberId}, 'employe')`;
      console.log("Lien d'invitation d'employé ajouté.");
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

    // Back to three featured products whenever fewer than two are left.
    const [{ featured }] = await tx`
      select count(*)::int as featured from products where shop_id = 1 and featured_at is not null and not archived`;
    if (featured < 2) {
      await tx`
        update products set featured_at = now() + (array_position(${FEATURED}::text[], name) || ' seconds')::interval
        where shop_id = 1 and name in ${sql(FEATURED)} and featured_at is null and not archived`;
      console.log("Produits phares d'exemple mis en avant.");
    }
  });
} finally {
  await sql.end();
}
