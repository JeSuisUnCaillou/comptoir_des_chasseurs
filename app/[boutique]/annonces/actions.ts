"use server";

import { revalidateShop } from "../revalidate";
import { requireMember } from "@/lib/auth/session";
import { BODY_MAX, PINS, TITLE_MAX } from "@/lib/announcement-rules";
import { postAnnouncement as post, takeDown } from "@/lib/announcements";

export type AnnouncementState = { ok: boolean; message: string; id?: number } | null;

function revalidate() {
  revalidateShop();
}

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

  const id = await post(member, { title, body, pin });
  revalidate();
  return { ok: true, message: "Le parchemin est accroché au tableau.", id };
}

/** Takes a parchment off the board: its author or a gérant may. */
export async function takeDownAnnouncement(formData: FormData) {
  const member = await requireMember();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return;
  if (await takeDown(member, id)) revalidate();
}
