import "server-only";
import { cache } from "react";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { UserError } from "@/lib/errors";
import { LOGO_MAX_BYTES, LOGO_MAX_SIDE } from "@/lib/logo";

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/**
 * When the shop's logo was last uploaded (its version, in milliseconds), or
 * null when it has none and shows the app's.
 */
export const shopLogoVersion = cache(async function shopLogoVersion(shopId: number): Promise<number | null> {
  const [logo] = await getDb()
    .select({ updatedAt: schema.shopLogos.updatedAt })
    .from(schema.shopLogos)
    .where(eq(schema.shopLogos.shopId, shopId))
    .limit(1);
  return logo ? logo.updatedAt.getTime() : null;
});

/** The logo of the shop at /<slug>, with its bytes, or undefined. */
export async function shopLogo(slug: string) {
  const [logo] = await getDb()
    .select({ contentType: schema.shopLogos.contentType, data: schema.shopLogos.data })
    .from(schema.shopLogos)
    .innerJoin(schema.shops, eq(schema.shops.id, schema.shopLogos.shopId))
    .where(eq(schema.shops.slug, slug))
    .limit(1);
  return logo;
}

/**
 * A gérant sets the shop's logo. The page has already shrunk the image to a
 * PNG of at most LOGO_MAX_SIDE pixels a side: anything else is refused, so
 * the database only ever holds small PNGs (never an SVG, which could carry a script).
 */
export async function saveShopLogo(shopId: number, bytes: Uint8Array) {
  if (bytes.length === 0) throw new UserError("Choisis une image.");
  if (bytes.length > LOGO_MAX_BYTES) throw new UserError("Cette image est trop lourde, même réduite : essaie une image plus simple.");
  const png = PNG_SIGNATURE.every((b, i) => bytes[i] === b);
  if (!png) throw new UserError("Ce fichier n'est pas une image que la page a pu lire.");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // The IHDR chunk, always first, gives the width and height.
  const width = bytes.length >= 24 ? view.getUint32(16) : 0;
  const height = bytes.length >= 24 ? view.getUint32(20) : 0;
  if (!width || !height || width > LOGO_MAX_SIDE || height > LOGO_MAX_SIDE) {
    throw new UserError(`L'image doit faire au plus ${LOGO_MAX_SIDE} pixels de côté.`);
  }
  const values = { shopId, contentType: "image/png", data: Buffer.from(bytes), updatedAt: new Date() };
  await getDb()
    .insert(schema.shopLogos)
    .values(values)
    .onConflictDoUpdate({ target: schema.shopLogos.shopId, set: { contentType: values.contentType, data: values.data, updatedAt: values.updatedAt } });
}

/** A gérant removes the shop's logo: it shows the app's again. */
export async function removeShopLogo(shopId: number) {
  await getDb().delete(schema.shopLogos).where(eq(schema.shopLogos.shopId, shopId));
}
