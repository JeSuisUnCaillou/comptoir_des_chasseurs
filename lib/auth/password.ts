import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const KEY_LENGTH = 64;

function derive(password: string, salt: Buffer) {
  return new Promise<Buffer>((resolve, reject) =>
    scrypt(password.normalize("NFKC"), salt, KEY_LENGTH, (error, key) =>
      error ? reject(error) : resolve(key),
    ),
  );
}

/** "scrypt$<salt>$<hash>", both base64. */
export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = await derive(password, salt);
  return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64");
  const key = await derive(password, Buffer.from(salt, "base64"));
  return key.length === expected.length && timingSafeEqual(key, expected);
}

export const MIN_PASSWORD_LENGTH = 8;

/** The password hash of an account opened with Discord alone: no password opens it. */
export const NO_PASSWORD = "";

/** True when the account has a password: one opened with Discord alone has none until its owner chooses one. */
export function hasPassword(member: { passwordHash: string }) {
  return member.passwordHash !== NO_PASSWORD;
}

export function normalizeUsername(raw: unknown) {
  return String(raw ?? "").trim().toLowerCase().slice(0, 40);
}

/** Why a new password (typed twice when `confirm` is given) can't be used, or null. */
export function newPasswordError(password: string, confirm?: FormDataEntryValue | null) {
  if (password.length < MIN_PASSWORD_LENGTH) return `Le mot de passe doit faire au moins ${MIN_PASSWORD_LENGTH} caractères.`;
  if (confirm !== undefined && password !== confirm) return "Les deux mots de passe ne correspondent pas.";
  return null;
}

/** Why a new username can't be used, or null. */
export function usernameError(username: string) {
  return /^[a-z0-9._-]+$/.test(username)
    ? null
    : "L'identifiant ne peut contenir que des lettres, chiffres, points et tirets.";
}
