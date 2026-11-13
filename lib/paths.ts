/**
 * Addresses of the app. Every shop lives under its slug: /<slug>/inventaire…
 * Pure: usable from pages, actions and client components alike.
 */

/** The comptoir, the first shop: the pages it had before shops keep leading to it. */
export const FIRST_SHOP_SLUG = "le-comptoir-des-chasseurs";

/** The comptoir keeps its address, which its old links lead to, and can't be deleted. */
export function isComptoir(shop: { slug: string }) {
  return shop.slug === FIRST_SHOP_SLUG;
}

/** The pages of a shop, which also had these addresses before shops (see next.config.ts). */
export const SHOP_PAGES = [
  "achat-vente",
  "annonces",
  "fournisseurs",
  "inventaire",
  "marchandises",
  "membres",
  "mot-de-passe",
  "tarifs",
] as const;

/** First segments that are no shop: the app's own pages, and the old addresses of the comptoir's pages. */
export const RESERVED_SLUGS: readonly string[] = ["api", "auth", "boutiques", "connexion", "invitation", ...SHOP_PAGES];

/** Longest shop address, the slash aside. */
export const MAX_SLUG_LENGTH = 40;

/**
 * The address a shop named `name` gets: lower case, accents dropped, words
 * joined by dashes: "La Taverne du Port" → "la-taverne-du-port". "" when
 * the name has no letter or digit.
 */
export function slugify(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/^-+|-+$/g, "");
}

/** The address of the invitation link `token`. */
export function invitationPath(token: string) {
  return `/invitation/${token}`;
}

/** The address of `path` ("/inventaire", "/" for its Grand livre) in the shop `slug`. */
export function shopPath(slug: string, path = "/") {
  return path === "/" ? `/${slug}` : `/${slug}${path}`;
}

/** The shop slug a path starts with, or null for a page outside any shop. */
export function slugOf(path: string | null | undefined): string | null {
  const first = (path ?? "").split(/[/?#]/)[1] ?? "";
  if (!first || RESERVED_SLUGS.includes(first) || !/^[a-z0-9-]+$/.test(first)) return null;
  return first;
}
