"use server";

import { and, eq, exists, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb, isUniqueViolation, schema } from "@/lib/db";
import { memberRole, type MemberRole } from "@/lib/db/schema";
import { MIN_PASSWORD_LENGTH, hashPassword, normalizeUsername } from "@/lib/auth/password";
import { requireMember, type ShopMember } from "@/lib/auth/session";

export type MemberFormState = { ok: boolean; message: string } | null;

function readRole(formData: FormData): MemberRole | null {
  const role = String(formData.get("role")) as MemberRole;
  return memberRole.enumValues.includes(role) ? role : null;
}

export async function createMember(_prev: MemberFormState, formData: FormData): Promise<MemberFormState> {
  const me = await requireMember(["gerant"]);
  const username = normalizeUsername(formData.get("username"));
  const name = String(formData.get("name") ?? "").trim().slice(0, 60);
  const password = String(formData.get("password") ?? "");
  const role = readRole(formData);
  if (!username || !name || !role) return { ok: false, message: "Tous les champs sont obligatoires." };
  if (!/^[a-z0-9._-]+$/.test(username)) {
    return { ok: false, message: "L'identifiant ne peut contenir que des lettres, chiffres, points et tirets." };
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, message: `Le mot de passe doit faire au moins ${MIN_PASSWORD_LENGTH} caractères.` };
  }
  const passwordHash = await hashPassword(password);
  try {
    await getDb().transaction(async (tx) => {
      const [member] = await tx
        .insert(schema.members)
        .values({ username, name, role, passwordHash })
        .returning({ id: schema.members.id });
      await tx.insert(schema.shopMembers).values({ shopId: me.shopId, memberId: member.id, role });
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { ok: false, message: "Cet identifiant est déjà pris." };
    }
    throw error;
  }
  revalidatePath("/membres");
  return { ok: true, message: `Compte « ${username} » créé. Donne-lui son mot de passe.` };
}

/**
 * The accounts a gérant may change: those of their shop. Only the super admin
 * themself may change their account; to anyone else the update matches no row.
 */
function editableBy(me: ShopMember, id: number) {
  return and(
    eq(schema.members.id, id),
    or(eq(schema.members.superAdmin, false), eq(schema.members.id, me.id)),
    exists(
      getDb()
        .select({ one: sql`1` })
        .from(schema.shopMembers)
        .where(and(eq(schema.shopMembers.shopId, me.shopId), eq(schema.shopMembers.memberId, schema.members.id))),
    ),
  );
}

export async function updateMember(formData: FormData) {
  const me = await requireMember(["gerant"]);
  const id = Number(formData.get("id"));
  const name = String(formData.get("name") ?? "").trim().slice(0, 60);
  const role = readRole(formData);
  if (!Number.isInteger(id) || !name || !role) return;
  // A gérant cannot demote themself, so the shop always keeps a gérant.
  await getDb().transaction(async (tx) => {
    const [member] = await tx
      .update(schema.members)
      .set({ name })
      .where(editableBy(me, id))
      .returning({ id: schema.members.id, superAdmin: schema.members.superAdmin });
    if (!member) return;
    await tx
      .update(schema.shopMembers)
      .set({ role: id === me.id || member.superAdmin ? "gerant" : role })
      .where(and(eq(schema.shopMembers.shopId, me.shopId), eq(schema.shopMembers.memberId, id)));
  });
  revalidatePath("/", "layout");
}

export async function resetPassword(_prev: MemberFormState, formData: FormData): Promise<MemberFormState> {
  const me = await requireMember(["gerant"]);
  const id = Number(formData.get("id"));
  const password = String(formData.get("password") ?? "");
  if (!Number.isInteger(id)) return { ok: false, message: "Membre inconnu." };
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, message: `${MIN_PASSWORD_LENGTH} caractères minimum.` };
  }
  const changed = await getDb()
    .update(schema.members)
    .set({ passwordHash: await hashPassword(password) })
    .where(editableBy(me, id))
    .returning({ id: schema.members.id });
  if (changed.length === 0) return { ok: false, message: "Ce compte est protégé." };
  return { ok: true, message: "Mot de passe changé." };
}
