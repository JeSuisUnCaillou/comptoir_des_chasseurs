import { redirect } from "next/navigation";
import { currentAccount } from "@/lib/auth/session";
import { canSignIn } from "@/lib/members";
import { shopPath } from "@/lib/paths";
import { accountShops } from "@/lib/shops";

export const dynamic = "force-dynamic";

/** /: straight into the account's shop when it has exactly one, else the choice of its shops. */
export default async function Accueil() {
  const account = await currentAccount();
  if (!account) redirect("/connexion");
  const shops = await accountShops(account);
  // Deactivated in all its shops: signed out, as the login page refuses it.
  if (shops.length === 0 && !(await canSignIn(account.id))) redirect("/connexion");
  redirect(shops.length === 1 ? shopPath(shops[0].slug) : "/boutiques");
}
