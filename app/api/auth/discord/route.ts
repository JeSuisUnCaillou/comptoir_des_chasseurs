import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const clientId = process.env.DISCORD_CLIENT_ID;
  if (!clientId) {
    return NextResponse.redirect(new URL("/connexion?erreur=config", request.url));
  }
  const state = crypto.randomUUID();
  (await cookies()).set("oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  const url = new URL("https://discord.com/oauth2/authorize");
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: new URL("/api/auth/discord/callback", request.url).toString(),
    response_type: "code",
    scope: "identify",
    state,
    prompt: "none",
  }).toString();
  return NextResponse.redirect(url);
}
