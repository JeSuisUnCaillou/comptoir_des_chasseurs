import "server-only";
import { count, desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";

/** Announcements, newest first, with their author's name. */
export async function announcementList({ limit, offset = 0 }: { limit: number; offset?: number }) {
  const a = schema.announcements;
  return getDb()
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
    .orderBy(desc(a.createdAt), desc(a.id))
    .limit(limit)
    .offset(offset);
}

export type AnnouncementEntry = Awaited<ReturnType<typeof announcementList>>[number];

export async function announcementCount() {
  const [row] = await getDb().select({ total: count() }).from(schema.announcements);
  return row.total;
}
