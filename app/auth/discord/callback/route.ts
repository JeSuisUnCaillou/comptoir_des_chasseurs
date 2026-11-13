import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { discordUser, finishDiscordFlow, rememberPendingDiscord } from "@/lib/auth/discord";
import { RETURN_PARAM, loginUrl } from "@/lib/auth/return-path";
import { currentAccount, startSession } from "@/lib/auth/session";
import { UserError } from "@/lib/errors";
import { accountByDiscordId, hasActiveShop, linkDiscord } from "@/lib/members";

const ACCOUNT_PAGE = "/mot-de-passe";

/** Where Discord sends the visitor back, with a code that says who they are. */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const flow = await finishDiscordFlow(params.get("state"));
  if (!flow) redirect("/connexion?discord=erreur");
  const code = params.get("code");
  const user = code ? await discordUser(request.nextUrl.origin, code) : null;

  if (flow.mode === "link") {
    const account = await currentAccount();
    if (!account || account.id !== flow.memberId) redirect(loginUrl(ACCOUNT_PAGE));
    if (!user) redirect(`${ACCOUNT_PAGE}?discord=erreur`);
    let outcome = "lie";
    try {
      await startSession(await linkDiscord(account.id, user));
    } catch (error) {
      if (!(error instanceof UserError)) throw error;
      outcome = "pris";
    }
    redirect(`${ACCOUNT_PAGE}?discord=${outcome}`);
  }

  const back = (query: string) =>
    flow.returnPath === "/"
      ? `/connexion?${query}`
      : `/connexion?${RETURN_PARAM}=${encodeURIComponent(flow.returnPath)}&${query}`;
  if (!user) redirect(back("discord=erreur"));
  const member = await accountByDiscordId(user.id);
  if (!member) {
    // Nobody linked it yet: signing in once with a password will.
    await rememberPendingDiscord(user);
    redirect(back("discord=inconnu"));
  }
  if (!(member.superAdmin || (await hasActiveShop(member.id)))) redirect(back("discord=refuse"));
  await startSession(member);
  redirect(flow.returnPath);
}
