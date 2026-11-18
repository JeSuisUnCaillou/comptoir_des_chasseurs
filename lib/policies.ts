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
 * own (cancel it, settle it with the till, edit or take it down).
 */
export function canActOn(member: Actor, owned: { memberId: number }) {
  return isGerant(member) || owned.memberId === member.id;
}

/** The super admin is a gérant in every shop, whatever their role there says. */
export function effectiveRole(account: { role: MemberRole; superAdmin: boolean }): MemberRole {
  return account.superAdmin ? "gerant" : account.role;
}

/**
 * Changing an account's name and role: nobody touches the super admin's
 * account but the super admin. `lib/members.ts` (`editableBy`) refuses the
 * same in SQL.
 */
export function canEditAccount(me: { id: number }, target: { id: number; superAdmin: boolean }) {
  return !target.superAdmin || target.id === me.id;
}

/**
 * Resetting a password, deactivating or reactivating: never one's own
 * account, nor the super admin's. `lib/members.ts` (`resetAccountPassword`,
 * `setAccountActive`) refuses the same in SQL.
 */
export function canResetOrDeactivate(me: { id: number }, target: { id: number; superAdmin: boolean }) {
  return target.id !== me.id && !target.superAdmin;
}

/** Opening a shop, for oneself or for someone by an invitation: the super admin only. */
export function canOpenShop(account: { superAdmin: boolean }) {
  return account.superAdmin;
}
