import { LogOut, Store } from "lucide-react";
import Link from "next/link";
import { BrandMark } from "@/components/brand";
import {
  InvitationLink,
  InviteGerantForm,
  OpenShopForm,
} from "@/components/shop-forms";
import { logout } from "@/app/connexion/actions";
import { requireAccount } from "@/lib/auth/session";
import { pendingInvitations } from "@/lib/invitations";
import { invitationPath, shopPath } from "@/lib/paths";
import { accountShops } from "@/lib/shops";

export const dynamic = "force-dynamic";

const ROLE_LABELS = {
  gerant: "Gérant",
  employe: "Employé",
  desactive: "Désactivé",
} as const;

/**
 * /boutiques: the shops the signed-in account may enter, opening a shop of
 * its own and, for the super admin, inviting someone to run a new one.
 */
export default async function Boutiques() {
  const account = await requireAccount("/boutiques");
  const shops = await accountShops(account);
  const invitations = account.superAdmin ? await pendingInvitations() : [];

  return (
    <main className="gate">
      <div className="gate-card gate-card-wide">
        <BrandMark />
        <div className="eyebrow">Keizaal · Bordeciel</div>
        <h1>Mes boutiques</h1>
        <p className="muted">
          Bienvenue, {account.name}.{" "}
          {shops.length > 0
            ? "Choisis la boutique où entrer."
            : "Tu n'as pas encore de boutique : ouvre la tienne."}
        </p>
        <div className="gate-divider" aria-hidden="true">
          ◆ ━━━ ✦ ━━━ ◆
        </div>
        {shops.length > 0 && (
          <nav aria-label="Mes boutiques">
            <ul className="shop-list">
              {shops.map((shop) => (
                <li key={shop.id}>
                  <Link className="btn shop-link" href={shopPath(shop.slug)}>
                    <Store size={16} /> {shop.name}
                    <span className="small muted">
                      {" "}
                      · {ROLE_LABELS[shop.role]}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}

        <section className="gate-section" aria-labelledby="open-shop">
          <h2 id="open-shop">Ouvrir une boutique</h2>
          <p className="small muted">
            Tu en seras le gérant, et tu pourras y créer les comptes de tes
            employés.
          </p>
          <OpenShopForm />
        </section>

        {account.superAdmin && (
          <section className="gate-section" aria-labelledby="invite-gerant">
            <h2 id="invite-gerant">Ouvrir une boutique pour quelqu&apos;un</h2>
            <p className="small muted">
              Tu reçois un lien à lui donner : en l&apos;ouvrant, il en devient
              le gérant, avec son compte ou un nouveau. Chaque lien ne sert
              qu&apos;une fois.
            </p>
            <InviteGerantForm />
            {invitations.length > 0 && (
              <>
                <h3>Invitations en attente</h3>
                <ul className="shop-list" aria-label="Invitations en attente">
                  {invitations.map((invitation) => (
                    <li key={invitation.id}>
                      <span className="small">{invitation.shopName}</span>
                      <InvitationLink
                        path={invitationPath(invitation.token)}
                        label={`Lien d'invitation de ${invitation.shopName}`}
                      />
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        )}

        <form className="gate-logout" action={logout}>
          <button className="btn btn-small btn-ghost" type="submit">
            <LogOut size={14} /> Se déconnecter
          </button>
        </form>
      </div>
    </main>
  );
}
