import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { discordConfigured, startDiscordFlow } from "@/lib/auth/discord";
import { RETURN_PARAM, safeReturnPath } from "@/lib/auth/return-path";
import { requireAccount } from "@/lib/auth/session";

/**
 * Sends the visitor to Discord: to sign in, or, signed in, to link their
 * Discord account (`?lier`). `?suite=` is the page to come back to.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  if (!discordConfigured()) redirect("/connexion");
  const origin = request.nextUrl.origin;
  const returnPath = safeReturnPath(params.get(RETURN_PARAM));
  if (params.has("lier")) {
    const account = await requireAccount(returnPath);
    redirect(await startDiscordFlow(origin, { mode: "link", memberId: account.id, returnPath }));
  }
  redirect(await startDiscordFlow(origin, { mode: "login", returnPath }));
}
