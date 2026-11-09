"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb, schema } from "@/lib/db";
import { memberRole, type MemberRole } from "@/lib/db/schema";
import { requireMember } from "@/lib/auth/session";

export async function updateMember(formData: FormData) {
  const me = await requireMember(["gerant"]);
  const id = Number(formData.get("id"));
  const name = String(formData.get("name") ?? "").trim().slice(0, 60);
  const role = String(formData.get("role")) as MemberRole;
  if (!Number.isInteger(id) || !name || !memberRole.enumValues.includes(role)) return;

  // A gérant cannot demote themself, so the comptoir always keeps a gérant.
  const newRole = id === me.id ? "gerant" : role;
  await getDb()
    .update(schema.members)
    .set({ name, role: newRole })
    .where(eq(schema.members.id, id));
  revalidatePath("/", "layout");
}
