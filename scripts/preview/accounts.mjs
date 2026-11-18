// The preview's own accounts, so a preview can always be entered: Caillou's
// gérant Lomone and a second gérante, Aela, with the same password. Shared by
// the preview seed and the copy of production into the preview database.
//
// The password is stored as a scrypt hash only, never in clear.

export const GERANT = {
  username: "lomone",
  name: "Lomone",
  passwordHash:
    "scrypt$nCyAZPZdFcvX4ZcPobSYXA==$fRPqmmGDJi4EBj/yJGJfdxePeTqbFU2f/pcUhtczR+2wHaDZgGOqNy939utA/AH8KB+L2AbvUE+1WD3P5DPzRQ==",
};

// A second gérant, with Lomone's password, to see from another gérant's seat
// that the super admin's account (Lomone, unless someone already was) cannot be
// changed. Never made super admin here.
export const SECOND_GERANT = { username: "aela", name: "Aela" };

/** Adds Lomone and Aela as gérants of the comptoir when missing; returns Lomone's id. */
export async function ensurePreviewAccounts(tx) {
  const [gerant] = await tx`
    insert into members (username, name, password_hash)
    values (${GERANT.username}, ${GERANT.name}, ${GERANT.passwordHash})
    on conflict (username) do nothing
    returning id`;
  console.log(gerant ? "Gérant Lomone créé." : "Gérant Lomone déjà présent.");

  const [second] = await tx`
    insert into members (username, name, password_hash)
    values (${SECOND_GERANT.username}, ${SECOND_GERANT.name}, ${GERANT.passwordHash})
    on conflict (username) do nothing
    returning id`;
  console.log(second ? "Gérante Aela créée." : "Gérante Aela déjà présente.");

  // Both are gérants of the first shop (the comptoir); kept if already there.
  await tx`
    insert into shop_members (shop_id, member_id, role)
    select 1, id, 'gerant' from members where username in (${GERANT.username}, ${SECOND_GERANT.username})
    on conflict do nothing`;

  // The members migration only names the owner's prod account: Lomone becomes
  // super admin, unless someone already is.
  const [boss] = await tx`
    update members set super_admin = true
    where username = ${GERANT.username}
      and exists (select 1 from shop_members s where s.member_id = members.id and s.shop_id = 1 and s.role = 'gerant')
      and not exists (select 1 from members where super_admin)
    returning id`;
  if (boss) console.log("Lomone est super admin.");

  const [{ id }] = await tx`select id from members where username = ${GERANT.username}`;
  return id;
}

// Left in the preview database by the copy of production
// (scripts/preview/copy-prod.mjs): while it is there, the seed adds no samples.
export const COPY_MARKER = "copie_de_la_prod";

export async function holdsProdCopy(tx) {
  const [{ copied }] = await tx`select to_regclass(${`public.${COPY_MARKER}`}) is not null as copied`;
  return copied;
}
