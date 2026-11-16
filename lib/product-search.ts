// Finding a merchandise by what a member types: its own name, or a name the
// game shows for it that the shop tied to it (lib/game-count.ts). Pure.

import { normalizeName } from "@/lib/game-count";

/**
 * Whether a merchandise answers a search: its name contains the text, or one
 * of its game names does ("deer" finds Biche once "Deer Pelt" is tied to it).
 * The game names are normalized, so the text is too before it is compared.
 */
export function matchesSearch(query: string, name: string, aliases: readonly string[] = []) {
  const q = query.trim().toLocaleLowerCase("fr");
  if (!q || name.toLocaleLowerCase("fr").includes(q)) return true;
  const key = normalizeName(query);
  return key !== "" && aliases.some((alias) => alias.includes(key));
}
