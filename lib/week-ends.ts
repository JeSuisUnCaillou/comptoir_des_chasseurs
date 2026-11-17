import "server-only";
import { desc, eq } from "drizzle-orm";
import type { ShopMember } from "@/lib/auth/session";
import { getDb, schema } from "@/lib/db";
import { UserError } from "@/lib/errors";
import { isGerant } from "@/lib/policies";

export type WeekEnd = { declaredAt: Date; by: string };

/** The shop's latest declared end of the week, with who declared it; null before the first. */
export async function lastWeekEnd(shopId: number): Promise<WeekEnd | null> {
  const w = schema.weekEnds;
  const [row] = await getDb()
    .select({ declaredAt: w.declaredAt, by: schema.members.name })
    .from(w)
    .innerJoin(schema.members, eq(schema.members.id, w.memberId))
    .where(eq(w.shopId, shopId))
    .orderBy(desc(w.declaredAt), desc(w.id))
    .limit(1);
  return row ?? null;
}

/** Ends the shop's week now: the Grand livre's tiles count again from zero. A gérant only. */
export async function declareWeekEnd(member: Pick<ShopMember, "id" | "role" | "shopId">) {
  if (!isGerant(member)) throw new UserError("Seul un gérant peut déclarer la fin de semaine.");
  await getDb().insert(schema.weekEnds).values({ shopId: member.shopId, memberId: member.id });
}
