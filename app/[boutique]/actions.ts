"use server";

import { revalidateShop } from "./revalidate";
import { requireMember } from "@/lib/auth/session";
import { attempt } from "@/lib/errors";
import { declareWeekEnd as declare } from "@/lib/week-ends";

export type WeekEndState = { ok: boolean; message: string } | null;

/** Ends the shop's week: the Grand livre's tiles start again from zero. A gérant only. */
export async function declareWeekEnd(_prev: WeekEndState): Promise<WeekEndState> {
  const member = await requireMember();
  const result = await attempt(() => declare(member));
  if (!result.ok) return { ok: false, message: result.message };
  revalidateShop();
  return { ok: true, message: "La fin de semaine est déclarée : les chiffres repartent de zéro." };
}
