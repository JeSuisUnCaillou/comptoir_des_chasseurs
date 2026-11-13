import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { discordConfigured, startDiscordFlow } from "@/lib/auth/discord";
import { RETURN_PARAM, loginUrl, safeReturnPath } from "@/lib/auth/return-path";
import { currentAccount } from "@/lib/auth/session";

/**
 * Sends the visitor to Discord: to sign in (`?suite=` the page to open next),
 * or, signed in, to link their Discord account (`?lier`).
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  if (!discordConfigured()) redirect("/connexion");
  const origin = request.nextUrl.origin;
  if (params.has("lier")) {
    const account = await currentAccount();
    if (!account) redirect(loginUrl("/mot-de-passe"));
    redirect(await startDiscordFlow(origin, { mode: "link", memberId: account.id }));
  }
  const returnPath = safeReturnPath(params.get(RETURN_PARAM));
  redirect(await startDiscordFlow(origin, { mode: "login", returnPath }));
}
