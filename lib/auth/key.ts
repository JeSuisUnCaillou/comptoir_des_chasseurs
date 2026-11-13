/** True when AUTH_SECRET is long enough to sign sessions. */
export function authConfigured() {
  return (process.env.AUTH_SECRET?.length ?? 0) >= 32;
}

/** The key that signs sessions and the short-lived sign-in cookies. */
export function authKey() {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 32) {
    throw new Error("AUTH_SECRET manquant ou trop court (32 caractères minimum).");
  }
  return new TextEncoder().encode(value);
}
