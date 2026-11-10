// Turns an export of the old app (scripts/legacy/export.mjs) into rows of the
// new schema (lib/db/schema.ts). Pure: no database, no network.
//
// The old app's shapes were read from its front end; fields are looked up
// under the names it uses, with a few fallbacks, and every row that cannot be
// placed is reported in `warnings` instead of being dropped silently.

const CATEGORIES = {
  skin: "peau",
  skins: "peau",
  peau: "peau",
  leather: "cuir",
  cuir: "cuir",
  meat: "viande",
  meats: "viande",
  viande: "viande",
  resource: "ressource",
  ressource: "ressource",
};

const PINS = { knife: "couteau", axe: "hache", meat: "viande" };

const MAX_INT = 2_147_483_647;

/**
 * @param data the export file's content
 * @param members rows of the target's members table ({ id, username, name, role })
 */
export function mapLegacy(data, members) {
  const warnings = [];
  const warn = (message) => warnings.push(message);

  // --- Members: the target's accounts stay; legacy authors are matched by
  // username or name.
  const gerant = [...members].sort((a, b) => a.id - b.id).find((m) => m.role === "gerant");
  if (!gerant) throw new Error("La base cible n'a aucun gérant : crée d'abord le compte du gérant.");
  const memberByKey = new Map();
  for (const m of members) {
    memberByKey.set(key(m.username), m);
    memberByKey.set(key(m.name), m);
  }
  for (const u of list(data.users, "users")) {
    const m = memberByKey.get(key(u.username));
    if (m && u.display_name) memberByKey.set(key(u.display_name), m);
  }
  // Authors with no account get one, without a password: the gérant gives
  // them one from the Membres page. Until written, they are known by `ref`.
  const newMembers = [];
  const taken = new Set(members.map((m) => m.username));
  // Same rule as the Membres page ([a-z0-9._-], 40 max), and never one in use.
  const freeUsername = (name) => {
    const base =
      key(name)
        .replace(/æ/g, "ae")
        .replace(/œ/g, "oe")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9._-]+/g, ".")
        .replace(/^\.+|\.+$/g, "")
        .slice(0, 36) || "employe";
    let username = base;
    for (let n = 2; taken.has(username); n++) username = `${base}-${n}`;
    taken.add(username);
    return username;
  };
  const authorOf = (row) => {
    const name = (
      row.employee_name ?? row.author_name ?? row.manager_name ?? row.created_by_name ?? row.user_name
    )?.trim();
    if (!name) return gerant.id;
    let m = memberByKey.get(key(name));
    if (!m) {
      m = { id: `nouveau:${key(name)}`, username: freeUsername(name), name };
      newMembers.push(m);
      memberByKey.set(key(name), m);
    }
    return m.id;
  };

  // --- Products: the union of the inventory and both price lists, by name.
  const products = new Map();
  const product = (name) => {
    const k = key(name);
    if (!products.has(k)) {
      products.set(k, {
        name: String(name).trim(),
        category: "autre",
        unit: "pièce",
        stock: 0,
        buyPrice: null,
        buyQty: 1,
        sellPrice: null,
        sellQty: 1,
        bulkMin: null,
        bulkPrice: null,
        bulkQty: 1,
        hidesPerBatch: null,
        leatherPerBatch: null,
      });
    }
    return products.get(k);
  };
  const itemNameById = new Map();

  for (const item of list(data.inventory, "items")) {
    if (!item.name) continue;
    itemNameById.set(item.id, item.name);
    const p = product(item.name);
    p.category = CATEGORIES[key(item.category)] ?? "autre";
    if (item.unit) p.unit = item.unit;
    const quantity = int(item.quantity, `stock de ${item.name}`, warn) ?? 0;
    if (quantity < 0) warn(`Stock négatif pour ${item.name} (${quantity}) : mis à 0.`);
    p.stock = Math.max(0, quantity);
  }

  const tariffs = data.tariffs ?? {};
  for (const skin of tariffs.skins ?? []) {
    const name = skin.name ?? skin.item_name ?? itemNameById.get(skin.item_id);
    if (!name) continue;
    const p = product(name);
    p.category = "peau";
    if (p.unit === "pièce") p.unit = "peau";
    p.buyPrice = int(skin.buy_price, `prix d'achat de ${name}`, warn);
    p.sellPrice = int(skin.sell_price, `prix de vente de ${name}`, warn);
    p.hidesPerBatch = positive(skin.skins_needed);
    p.leatherPerBatch = positive(skin.leather_produced);
  }

  const settings = {};
  const leather = Array.isArray(tariffs.leather) ? tariffs.leather[0] : tariffs.leather;
  if (leather) {
    const name =
      leather.name ??
      leather.item_name ??
      itemNameById.get(leather.item_id) ??
      [...products.values()].find((p) => p.category === "cuir")?.name ??
      "Cuir";
    const p = product(name);
    p.category = "cuir";
    if (p.unit === "pièce") p.unit = "cuir";
    // The old API names them buy / sell / blacksmith.
    p.buyPrice = int(leather.buy ?? leather.buy_price, "prix d'achat du cuir", warn) ?? p.buyPrice;
    p.sellPrice = int(leather.sell ?? leather.sell_price, "prix de vente du cuir", warn) ?? p.sellPrice;
    const smith = int(leather.blacksmith ?? leather.blacksmith_price, "prix du forgeron", warn);
    if (smith !== null) settings.prix_forgeron_cuir = smith;
  }

  for (const meat of list(data.meats, "products")) {
    const name = meat.name ?? meat.item_name ?? itemNameById.get(meat.item_id);
    if (!name) continue;
    const p = product(name);
    p.category = CATEGORIES[key(meat.product_kind)] ?? (p.category === "autre" ? "viande" : p.category);
    if (meat.unit ?? meat.item_unit) p.unit = meat.unit ?? meat.item_unit;
    p.sellPrice = int(meat.sale_lot_price, `prix de vente de ${name}`, warn);
    p.sellQty = positive(meat.sale_lot_qty) ?? 1;
    p.buyPrice = int(meat.buy_lot_price, `prix d'achat de ${name}`, warn);
    p.buyQty = positive(meat.buy_lot_qty) ?? 1;
    p.bulkMin = positive(meat.bulk_from_qty);
    p.bulkPrice = p.bulkMin ? int(meat.bulk_unit_price, `prix de gros de ${name}`, warn) : null;
    p.bulkQty = 1;
  }

  // --- Stock history.
  const movements = [];
  for (const m of list(data.movements, "movements")) {
    const name = m.item_name ?? itemNameById.get(m.item_id);
    if (!name || !products.has(key(name))) {
      warn(`Mouvement de stock ignoré : marchandise inconnue (${name ?? m.item_id}).`);
      continue;
    }
    const delta = int(m.delta, "mouvement de stock", warn);
    if (!delta) continue;
    const memberId = authorOf(m);
    const reason = m.reason?.trim() || "Ancienne app";
    movements.push({
      productName: products.get(key(name)).name,
      delta,
      stockAfter: Math.max(0, int(m.after_qty ?? m.stock_after, "stock après mouvement", warn) ?? 0),
      memberId,
      reason,
      createdAt: date(m.created_at),
    });
  }

  // --- Register: sales, buybacks and treasury adjustments.
  const transactions = [];
  for (const t of Array.isArray(data.transactions) ? data.transactions : []) {
    const kind = t.type === "sale" ? "vente" : t.type === "purchase" ? "rachat" : null;
    if (!kind) {
      warn(`Transaction ${t.id} ignorée : type inconnu (${t.type}).`);
      continue;
    }
    const amount = int(t.amount, `montant de la transaction ${t.id}`, warn);
    if (amount === null || amount < 0) {
      warn(`Transaction ${t.id} ignorée : montant illisible (${t.amount}).`);
      continue;
    }
    let quantity = int(t.quantity, `quantité de la transaction ${t.id}`, warn) ?? 0;
    if (quantity <= 0) {
      warn(`Transaction ${t.id} : quantité ${t.quantity}, comptée 1.`);
      quantity = 1;
    }
    const label = (t.item_name ?? "").trim() || "Article";
    const memberId = authorOf(t);
    const notes = [
      t.notes?.trim(),
      t.voided_at && t.void_reason?.trim() && `Annulée : ${t.void_reason.trim()}`,
    ].filter(Boolean);
    transactions.push({
      kind,
      productName: products.get(key(label))?.name ?? null,
      label,
      quantity,
      amount,
      counterparty: t.customer_name?.trim() || null,
      notes: notes.join("\n") || null,
      memberId,
      createdAt: date(t.created_at),
      cancelledAt: t.voided_at ? date(t.voided_at) : null,
    });
  }
  for (const a of list(data.treasury, "adjustments")) {
    const amount = int(a.amount, "ajustement de trésorerie", warn);
    if (!amount) continue;
    const memberId = authorOf(a);
    transactions.push({
      kind: amount > 0 ? "entree" : "sortie",
      productName: null,
      label: "Ajustement de trésorerie",
      quantity: 1,
      amount: Math.abs(amount),
      counterparty: null,
      notes: a.description?.trim() || null,
      memberId,
      createdAt: date(a.created_at),
      cancelledAt: null,
    });
  }
  transactions.sort((a, b) => a.createdAt - b.createdAt);
  movements.sort((a, b) => a.createdAt - b.createdAt);

  // --- Board.
  const boardPosts = Array.isArray(data.board)
    ? data.board
    : ["posts", "board", "messages", "announcements"].map((f) => list(data.board, f)).find((l) => l.length) ?? [];
  const announcements = [];
  for (const post of boardPosts) {
    const title = post.title?.trim();
    const body = post.body?.trim();
    if (!title && !body) continue;
    const memberId = authorOf(post);
    announcements.push({
      title: title || "Annonce",
      body: body || title,
      pin: PINS[key(post.fastener)] ?? "couteau",
      memberId,
      createdAt: date(post.created_at),
    });
  }
  announcements.sort((a, b) => a.createdAt - b.createdAt);


  // Kept in the export file, with no place in the new app yet.
  const notImported = { fournisseurs: list(data.suppliers, "suppliers").length };

  return {
    newMembers: newMembers.map(({ id, username, name }) => ({ ref: id, username, name })),
    products: [...products.values()],
    settings,
    movements,
    transactions,
    announcements,
    warnings,
    notImported,
  };
}

/** Till as the new app counts it: sales and money in, buybacks and money out, cancelled lines aside. */
export function till(transactions) {
  return transactions
    .filter((t) => !t.cancelledAt)
    .reduce((sum, t) => sum + (t.kind === "vente" || t.kind === "entree" ? t.amount : -t.amount), 0);
}

function list(value, field) {
  if (Array.isArray(value)) return value;
  const inner = value?.[field];
  return Array.isArray(inner) ? inner : [];
}

function key(value) {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase("fr");
}

function int(value, what, warn) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number)) {
    warn(`Valeur illisible pour ${what} : ${value}.`);
    return null;
  }
  if (Math.abs(number) > MAX_INT) throw new Error(`Valeur trop grande pour ${what} : ${value}.`);
  if (!Number.isInteger(number)) warn(`${what} arrondi : ${value} → ${Math.round(number)}.`);
  return Math.round(number);
}

function positive(value) {
  const number = Math.round(Number(value));
  return Number.isFinite(number) && number > 0 ? number : null;
}

function date(value) {
  const d = value ? new Date(value) : null;
  return d && !Number.isNaN(d.getTime()) ? d : new Date();
}
