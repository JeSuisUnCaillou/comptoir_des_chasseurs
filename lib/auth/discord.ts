import "server-only";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { authKey } from "@/lib/auth/key";
import { safeReturnPath } from "@/lib/auth/return-path";

/**
 * Signing in with Discord (OAuth2, scope "identify"). Discord only tells who
 * the visitor is; the account still comes from the comptoir, where a member
 * links their Discord account themself.
 */

export type DiscordUser = { id: string; name: string };

/** Where the flow goes back to: sign in, or link Discord to the signed-in member. */
export type DiscordFlow =
  | { mode: "login"; returnPath: string }
  | { mode: "link"; memberId: number };

export const CALLBACK_PATH = "/auth/discord/callback";

const FLOW_COOKIE = "comptoir_discord";
const PENDING_COOKIE = "comptoir_discord_lien";
const COOKIE_AGE = 10 * 60;

// The e2e tests point these at a fake Discord.
const AUTHORIZE_URL = process.env.DISCORD_AUTHORIZE_URL ?? "https://discord.com/oauth2/authorize";
const API_URL = process.env.DISCORD_API_URL ?? "https://discord.com/api";

export function discordConfigured() {
  return Boolean(process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET);
}

async function sign(payload: Record<string, unknown>) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${COOKIE_AGE}s`)
    .sign(authKey());
}

async function verify(token: string | undefined) {
  if (!token) return null;
  try {
    return (await jwtVerify(token, authKey(), { algorithms: ["HS256"] })).payload;
  } catch {
    return null;
  }
}

async function setCookie(name: string, value: string) {
  (await cookies()).set(name, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    // Lax: the cookie comes back with Discord's redirect to the callback.
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_AGE,
  });
}

/**
 * Starts the flow: remembers where it goes back to, tied to a random state
 * Discord sends back, and gives the Discord page to send the visitor to.
 */
export async function startDiscordFlow(origin: string, flow: DiscordFlow) {
  const state = randomBytes(16).toString("base64url");
  await setCookie(FLOW_COOKIE, await sign({ state, ...flow }));
  const url = new URL(AUTHORIZE_URL);
  url.search = new URLSearchParams({
    response_type: "code",
    client_id: process.env.DISCORD_CLIENT_ID!,
    scope: "identify",
    state,
    redirect_uri: origin + CALLBACK_PATH,
  }).toString();
  return url.toString();
}

/** The flow this callback belongs to, once: null if the state doesn't match. */
export async function finishDiscordFlow(state: string | null): Promise<DiscordFlow | null> {
  const jar = await cookies();
  const payload = await verify(jar.get(FLOW_COOKIE)?.value);
  jar.delete(FLOW_COOKIE);
  if (!payload || !state || payload.state !== state) return null;
  if (payload.mode === "link" && typeof payload.memberId === "number") {
    return { mode: "link", memberId: payload.memberId };
  }
  if (payload.mode === "login") return { mode: "login", returnPath: safeReturnPath(payload.returnPath) };
  return null;
}

/** Trades the code Discord gave for who the visitor is on Discord, or null. */
export async function discordUser(origin: string, code: string): Promise<DiscordUser | null> {
  try {
    const token = await fetch(`${API_URL}/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: origin + CALLBACK_PATH,
        client_id: process.env.DISCORD_CLIENT_ID!,
        client_secret: process.env.DISCORD_CLIENT_SECRET!,
      }),
      cache: "no-store",
    });
    if (!token.ok) return null;
    const { access_token } = (await token.json()) as { access_token?: string };
    if (!access_token) return null;
    const me = await fetch(`${API_URL}/users/@me`, {
      headers: { Authorization: `Bearer ${access_token}` },
      cache: "no-store",
    });
    if (!me.ok) return null;
    const user = (await me.json()) as { id?: string; username?: string; global_name?: string | null };
    if (!user.id || !user.username) return null;
    return { id: user.id, name: user.global_name || user.username };
  } catch {
    return null;
  }
}

/**
 * A Discord account no member has linked yet: kept a few minutes, so the
 * visitor can sign in once with their username and password to link it.
 */
export async function rememberPendingDiscord(user: DiscordUser) {
  await setCookie(PENDING_COOKIE, await sign({ discordId: user.id, discordName: user.name }));
}

export async function pendingDiscord(): Promise<DiscordUser | null> {
  const payload = await verify((await cookies()).get(PENDING_COOKIE)?.value);
  if (typeof payload?.discordId !== "string" || typeof payload.discordName !== "string") return null;
  return { id: payload.discordId, name: payload.discordName };
}

export async function forgetPendingDiscord() {
  (await cookies()).delete(PENDING_COOKIE);
}
