/** Query parameter of /connexion that holds the page to go back to after login. */
export const RETURN_PARAM = "suite";

/** Request header set by proxy.ts with the path and query string being visited. */
export const PATH_HEADER = "x-comptoir-path";

/**
 * The page to open after login: a same-site relative path (with its query
 * string), or "/" for anything else, so a crafted link can't send a member
 * to another site.
 */
export function safeReturnPath(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/")) return "/";
  // "//host" and "/\host" are read by browsers as another site.
  if (value.startsWith("//") || value.startsWith("/\\")) return "/";
  try {
    const base = "http://comptoir.invalid";
    const url = new URL(value, base);
    if (url.origin !== base) return "/";
    if (url.pathname === "/connexion") return "/";
    return url.pathname + url.search + url.hash;
  } catch {
    return "/";
  }
}

/** The login page URL that comes back to `path` once signed in. */
export function loginUrl(path: string | null | undefined): string {
  const target = safeReturnPath(path);
  return target === "/" ? "/connexion" : `/connexion?${RETURN_PARAM}=${encodeURIComponent(target)}`;
}
