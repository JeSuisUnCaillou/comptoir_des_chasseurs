import "server-only";
import { eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";

/**
 * Finds or creates the member for a Discord account.
 * The very first member becomes gérant; everyone else waits for approval.
 */
export async function upsertDiscordMember(discordId: string, discordName: string) {
  const db = getDb();
  return db.transaction(async (tx) => {
    // Serialise first sign-ups so only one member can become the first gérant.
    await tx.execute(sql`lock table members in share row exclusive mode`);
    const [existing] = await tx
      .select()
      .from(schema.members)
      .where(eq(schema.members.discordId, discordId))
      .limit(1);
    if (existing) {
      const [updated] = await tx
        .update(schema.members)
        .set({ discordName })
        .where(eq(schema.members.id, existing.id))
        .returning();
      return updated;
    }
    const [anyGerant] = await tx
      .select({ id: schema.members.id })
      .from(schema.members)
      .where(eq(schema.members.role, "gerant"))
      .limit(1);
    const [created] = await tx
      .insert(schema.members)
      .values({
        discordId,
        discordName,
        name: discordName,
        role: anyGerant ? "en_attente" : "gerant",
      })
      .returning();
    return created;
  });
}
