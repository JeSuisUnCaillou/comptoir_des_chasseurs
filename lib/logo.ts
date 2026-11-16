/**
 * A shop's logo, shared by the page that shrinks the uploaded image and the
 * service that stores it. Pure: usable from client components.
 */

/** Longest side of a stored logo, in pixels: plenty for the menu and a browser tab. */
export const LOGO_MAX_SIDE = 256;

/** Heaviest stored logo, in bytes: a 256-pixel PNG fits well under it. */
export const LOGO_MAX_BYTES = 400 * 1024;

/** The default mark of the app, for a shop without a logo and the pages outside shops. */
export const APP_LOGO = "/icon.svg";

/** Where the logo of the shop `slug` is served; `version` changes with each upload. */
export function shopLogoPath(slug: string, version: number | null) {
  return version === null ? APP_LOGO : `/${slug}/logo?v=${version}`;
}
