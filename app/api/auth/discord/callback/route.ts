import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { upsertDiscordMember } from "@/lib/auth/members";
import { startSession } from "@/lib/auth/session";

type DiscordUser = { id: string; username: string; global_name: string | null };

export async function GET(request: NextRequest) {
  const fail = () => NextResponse.redirect(new URL("/connexion?erreur=discord", request.url));
  const params = request.nextUrl.searchParams;
  const code = params.get("code");
  const jar = await cookies();
  const expectedState = jar.get("oauth_state")?.value;
  jar.delete("oauth_state");
  if (!code || !expectedState || params.get("state") !== expectedState) return fail();

  const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: new URL("/api/auth/discord/callback", request.url).toString(),
      client_id: process.env.DISCORD_CLIENT_ID ?? "",
      client_secret: process.env.DISCORD_CLIENT_SECRET ?? "",
    }),
  });
  if (!tokenResponse.ok) return fail();
  const { access_token: accessToken } = (await tokenResponse.json()) as { access_token: string };

  const userResponse = await fetch("https://discord.com/api/users/@me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!userResponse.ok) return fail();
  const user = (await userResponse.json()) as DiscordUser;

  const member = await upsertDiscordMember(user.id, user.global_name ?? user.username);
  await startSession(member.id);
  return NextResponse.redirect(new URL("/", request.url));
}
