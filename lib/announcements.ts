import "server-only";
import { and, count, desc, eq } from "drizzle-orm";
import type { ShopMember } from "@/lib/auth/session";
import { getDb, schema } from "@/lib/db";
import type { AnnouncementPin } from "@/lib/db/schema";
import { UserError } from "@/lib/errors";
import { canActOn } from "@/lib/policies";

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

type Actor = Pick<ShopMember, "id" | "role" | "shopId">;

/** Pins a parchment on the shop's board. Returns its id. */
export async function postAnnouncement(member: Actor, values: AnnouncementValues) {
  const [posted] = await getDb()
    .insert(schema.announcements)
    .values({ ...values, shopId: member.shopId, memberId: member.id })
    .returning({ id: schema.announcements.id });
  return posted.id;
}

type AnnouncementValues = { title: string; body: string; pin: AnnouncementPin };

/** A parchment the member may change (its author or a gérant); null otherwise, or when it is gone. */
export async function editableAnnouncement(member: Actor, id: number) {
  const a = schema.announcements;
  const [announcement] = await getDb()
    .select({ id: a.id, title: a.title, body: a.body, pin: a.pin, memberId: a.memberId })
    .from(a)
    .where(and(eq(a.id, id), eq(a.shopId, member.shopId)));
  return announcement && canActOn(member, announcement) ? announcement : null;
}

/** Rewrites a parchment, keeping its place and date on the board: its author or a gérant may. */
export async function reviseAnnouncement(member: Actor, id: number, values: AnnouncementValues) {
  if (!(await editableAnnouncement(member, id))) {
    throw new UserError("Ce parchemin n'est plus au tableau, ou tu ne peux pas le modifier.");
  }
  const a = schema.announcements;
  await getDb()
    .update(a)
    .set(values)
    .where(and(eq(a.id, id), eq(a.shopId, member.shopId)));
}

/** Takes a parchment off the board: its author or a gérant may. False when it may not, or is gone. */
export async function takeDown(member: Actor, id: number) {
  if (!(await editableAnnouncement(member, id))) return false;
  const a = schema.announcements;
  await getDb()
    .delete(a)
    .where(and(eq(a.id, id), eq(a.shopId, member.shopId)));
  return true;
}
