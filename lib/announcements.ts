import "server-only";
import { count, desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";

/** Parchments per page of the board on the Annonces page. */
export const BOARD_SIZE = 12;

/** Announcements, newest first, with their author's name; all of them without a limit. */
export async function announcementList(
  shopId: number,
  { limit, offset = 0 }: { limit?: number; offset?: number } = {},
) {
  const a = schema.announcements;
  const query = getDb()
    .select({
      id: a.id,
      title: a.title,
      body: a.body,
      pin: a.pin,
      createdAt: a.createdAt,
      memberId: a.memberId,
      author: schema.members.name,
    })
    .from(a)
    .innerJoin(schema.members, eq(schema.members.id, a.memberId))
    .where(eq(a.shopId, shopId))
    .orderBy(desc(a.createdAt), desc(a.id))
    .$dynamic();
  return limit === undefined ? query : query.limit(limit).offset(offset);
}

export type AnnouncementEntry = Awaited<ReturnType<typeof announcementList>>[number];

export async function announcementCount(shopId: number) {
  const [row] = await getDb()
    .select({ total: count() })
    .from(schema.announcements)
    .where(eq(schema.announcements.shopId, shopId));
  return row.total;
}
