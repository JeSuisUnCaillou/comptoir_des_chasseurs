import { redirect } from "next/navigation";
import { currentAccount } from "@/lib/auth/session";
import { shopPath } from "@/lib/paths";
import { accountShops } from "@/lib/shops";

export const dynamic = "force-dynamic";

/** /: straight into the account's shop when it has one, else the choice of its shops. */
export default async function Accueil() {
  const account = await currentAccount();
  if (!account) redirect("/connexion");
  const shops = await accountShops(account);
  // Deactivated everywhere: signed out, as the login page refuses them.
  if (shops.length === 0) redirect("/connexion");
  redirect(shops.length === 1 ? shopPath(shops[0].slug) : "/boutiques");
}
