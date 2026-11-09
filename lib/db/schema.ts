import { pgEnum, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const memberRole = pgEnum("member_role", ["gerant", "employe", "en_attente", "refuse"]);

export const members = pgTable(
  "members",
  {
    id: serial("id").primaryKey(),
    discordId: text("discord_id").notNull(),
    discordName: text("discord_name").notNull(),
    name: text("name").notNull(),
    role: memberRole("role").notNull().default("en_attente"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("members_discord_id_idx").on(t.discordId)],
);

export type Member = typeof members.$inferSelect;
export type MemberRole = (typeof memberRole.enumValues)[number];
