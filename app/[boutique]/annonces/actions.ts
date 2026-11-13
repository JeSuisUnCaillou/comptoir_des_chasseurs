"use server";

import { revalidateShop } from "../revalidate";
import { redirect } from "next/navigation";
import { requireMember } from "@/lib/auth/session";
import { safeReturnPath } from "@/lib/auth/return-path";
import { BODY_MAX, PINS, TITLE_MAX } from "@/lib/announcement-rules";
import { postAnnouncement as post, reviseAnnouncement, takeDown } from "@/lib/announcements";
import { attempt } from "@/lib/errors";
import { optionalId } from "@/lib/forms";

export type AnnouncementState = { ok: boolean; message: string; id?: number } | null;

function revalidate() {
  revalidateShop();
}

/** The parchment's fields, or the message saying what is wrong with them. */
function readAnnouncement(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const pin = PINS.find((p) => p.value === formData.get("pin"))?.value;

  if (!title) return { error: "Donne un titre à l'annonce." };
  if (!body) return { error: "L'annonce est vide." };
  if (title.length > TITLE_MAX) return { error: `Le titre dépasse ${TITLE_MAX} caractères.` };
  if (body.length > BODY_MAX) return { error: `Le texte dépasse ${BODY_MAX} caractères.` };
  if (!pin) return { error: "Choisis avec quoi l'accrocher." };
  return { values: { title, body, pin } };
}

export async function postAnnouncement(_prev: AnnouncementState, formData: FormData): Promise<AnnouncementState> {
  const member = await requireMember();
  const { values, error } = readAnnouncement(formData);
  if (!values) return { ok: false, message: error };

  const id = await post(member, values);
  revalidate();
  return { ok: true, message: "Le parchemin est accroché au tableau.", id };
}

/** Rewrites a parchment, then goes back to the board it was opened from: its author or a gérant may. */
export async function editAnnouncement(_prev: AnnouncementState, formData: FormData): Promise<AnnouncementState> {
  const member = await requireMember();
  const id = optionalId(formData);
  if (!id) return { ok: false, message: "Ce parchemin n'existe pas." };
  const { values, error } = readAnnouncement(formData);
  if (!values) return { ok: false, message: error };

  const result = await attempt(() => reviseAnnouncement(member, id, values));
  if (!result.ok) return { ok: false, message: result.message };
  revalidate();
  redirect(safeReturnPath(formData.get("back")));
}

/** Takes a parchment off the board: its author or a gérant may. */
export async function takeDownAnnouncement(formData: FormData) {
  const member = await requireMember();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return;
  if (await takeDown(member, id)) revalidate();
}
