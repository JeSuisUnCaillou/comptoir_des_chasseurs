import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { discordUser, finishDiscordFlow, rememberPendingDiscord } from "@/lib/auth/discord";
import { loginUrl } from "@/lib/auth/return-path";
import { currentAccount, startSession } from "@/lib/auth/session";
import { attempt } from "@/lib/errors";
import { accountByDiscordId, canSignIn, linkDiscord } from "@/lib/members";

/** Where Discord sends the visitor back, with a code that says who they are. */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const flow = await finishDiscordFlow(params.get("state"));
  if (!flow) redirect("/connexion?discord=erreur");
  const code = params.get("code");
  const user = code ? await discordUser(request.nextUrl.origin, code) : null;

  if (flow.mode === "link") {
    // Back on the page the link started from (Mon compte), saying how it went.
    const back = (outcome: string) =>
      `${flow.returnPath}${flow.returnPath.includes("?") ? "&" : "?"}discord=${outcome}`;
    const account = await currentAccount();
    if (!account || account.id !== flow.memberId) redirect(loginUrl(flow.returnPath));
    if (!user) redirect(back("erreur"));
    const linked = await attempt(() => linkDiscord(account.id, user));
    if (linked.ok) await startSession(linked.value);
    redirect(back(linked.ok ? "lie" : "pris"));
  }

  const login = loginUrl(flow.returnPath);
  const back = (query: string) => `${login}${login.includes("?") ? "&" : "?"}${query}`;
  if (!user) redirect(back("discord=erreur"));
  const member = await accountByDiscordId(user.id);
  if (!member) {
    // Nobody linked it yet: signing in once with a password will.
    await rememberPendingDiscord(user);
    redirect(back("discord=inconnu"));
  }
  if (!(await canSignIn(member))) redirect(back("discord=refuse"));
  await startSession(member);
  redirect(flow.returnPath);
}
