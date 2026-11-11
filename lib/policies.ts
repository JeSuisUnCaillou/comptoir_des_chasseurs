import type { MemberRole } from "@/lib/db/schema";

/**
 * Who may do what in a shop. `role` is the member's role in the shop being
 * visited (the super admin is a gérant everywhere, see `currentMember`).
 */
type Actor = { id: number; role: MemberRole };

export function isGerant(member: Actor) {
  return member.role === "gerant";
}

/**
 * A register line, a parchment…: a gérant may act on any, a member on their
 * own (cancel it, settle it with the till, take it down).
 */
export function canActOn(member: Actor, owned: { memberId: number }) {
  return isGerant(member) || owned.memberId === member.id;
}
