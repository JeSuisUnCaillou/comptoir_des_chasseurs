import { LogOut, Store } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BrandMark } from "@/components/brand";
import { logout } from "@/app/connexion/actions";
import { currentAccount } from "@/lib/auth/session";
import { shopPath } from "@/lib/paths";
import { accountShops } from "@/lib/shops";

export const dynamic = "force-dynamic";

const ROLE_LABELS = { gerant: "Gérant", employe: "Employé", desactive: "Désactivé" } as const;

/**
 * /: the shops the signed-in account may enter. With a single one, it opens
 * straight away.
 */
export default async function Boutiques() {
  const account = await currentAccount();
  if (!account) redirect("/connexion");
  const shops = await accountShops(account);
  // Deactivated everywhere: signed out, as the login page refuses them.
  if (shops.length === 0) redirect("/connexion");
  if (shops.length === 1) redirect(shopPath(shops[0].slug));

  return (
    <main className="gate">
      <div className="gate-card">
        <BrandMark />
        <div className="eyebrow">Keizaal · Bordeciel</div>
        <h1>Mes boutiques</h1>
        <p className="muted">Bienvenue, {account.name}. Choisis la boutique où entrer.</p>
        <div className="gate-divider" aria-hidden="true">
          ◆ ━━━ ✦ ━━━ ◆
        </div>
        <nav aria-label="Mes boutiques">
          <ul className="shop-list">
            {shops.map((shop) => (
              <li key={shop.id}>
                <Link className="btn shop-link" href={shopPath(shop.slug)}>
                  <Store size={16} /> {shop.name}
                  <span className="small muted"> · {ROLE_LABELS[shop.role]}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <form action={logout}>
          <button className="btn btn-small btn-ghost" type="submit">
            <LogOut size={14} /> Se déconnecter
          </button>
        </form>
      </div>
    </main>
  );
}
