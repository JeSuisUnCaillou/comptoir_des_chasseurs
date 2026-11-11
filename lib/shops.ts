import "server-only";
import { cache } from "react";
import { asc } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import type { Shop } from "@/lib/db/schema";

/**
 * The shop being visited. Every page and action reads and writes the data of
 * this shop only. For now the app shows a single shop, the first one
 * (« Le Comptoir Des Chasseurs », created by the shops migration).
 */
export const currentShop = cache(async function currentShop(): Promise<Shop> {
  const [shop] = await getDb().select().from(schema.shops).orderBy(asc(schema.shops.id)).limit(1);
  if (!shop) throw new Error("Aucune boutique : les migrations n'ont pas été appliquées.");
  return shop;
});
