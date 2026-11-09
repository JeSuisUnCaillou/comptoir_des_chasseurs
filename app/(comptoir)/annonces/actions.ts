"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/auth/session";
import { getDb, schema } from "@/lib/db";
import { BODY_MAX, canTakeDown, PINS, TITLE_MAX } from "@/lib/announcement-rules";

export type AnnouncementState = { ok: boolean; message: string; id?: number } | null;

export async function postAnnouncement(_prev: AnnouncementState, formData: FormData): Promise<AnnouncementState> {
  const member = await requireMember();
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const pin = PINS.find((p) => p.value === formData.get("pin"))?.value;

  if (!title) return { ok: false, message: "Donne un titre à l'annonce." };
  if (!body) return { ok: false, message: "Écris le texte à afficher." };
  if (title.length > TITLE_MAX) return { ok: false, message: `Le titre dépasse ${TITLE_MAX} caractères.` };
  if (body.length > BODY_MAX) return { ok: false, message: `Le texte dépasse ${BODY_MAX} caractères.` };
  if (!pin) return { ok: false, message: "Choisis comment fixer le parchemin." };

  const [posted] = await getDb()
    .insert(schema.announcements)
    .values({ title, body, pin, memberId: member.id })
    .returning({ id: schema.announcements.id });
  revalidatePath("/");
  revalidatePath("/annonces");
  return { ok: true, message: "Le parchemin est accroché au tableau.", id: posted.id };
}

/** Takes a parchment off the board: its author or a gérant may. */
export async function takeDownAnnouncement(formData: FormData) {
  const member = await requireMember();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return;
  const db = getDb();
  const [announcement] = await db
    .select({ memberId: schema.announcements.memberId })
    .from(schema.announcements)
    .where(eq(schema.announcements.id, id));
  if (!announcement || !canTakeDown(member, announcement)) return;
  await db.delete(schema.announcements).where(eq(schema.announcements.id, id));
  revalidatePath("/");
  revalidatePath("/annonces");
}
