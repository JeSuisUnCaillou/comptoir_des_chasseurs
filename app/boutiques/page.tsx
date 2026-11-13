import type { Metadata } from "next";
import { DoorOpen, LogOut, Settings, Store, Users } from "lucide-react";
import Link from "next/link";
import { BrandMark } from "@/components/brand";
import { InvitationLink, InviteGerantForm, OpenShopForm } from "@/components/shop-forms";
import { logout } from "@/app/connexion/actions";
import { requireAccount } from "@/lib/auth/session";
import { pendingInvitations } from "@/lib/invitations";
import { invitationPath, shopPath } from "@/lib/paths";
import { canOpenShop } from "@/lib/policies";
import { accountShops } from "@/lib/shops";

export const metadata: Metadata = { title: "Mes boutiques" };

export const dynamic = "force-dynamic";

const longDate = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "Europe/Paris" });

const ROLE_LABELS = { gerant: "Gérant", employe: "Employé", desactive: "Désactivé" } as const;

/**
 * /boutiques: the shops the signed-in account may enter, as cards with its
 * role in each; for the super admin, opening a shop and inviting someone to
 * run a new one, with the links not used yet.
 */
export default async function Boutiques() {
  const account = await requireAccount("/boutiques");
  const shops = await accountShops(account);
  const invitations = canOpenShop(account) ? await pendingInvitations() : [];

  return (
    <div className="hub">
      <header className="hub-bar">
        <div className="hub-brand">
          <BrandMark />
          <span>
            <div className="brand-name">REGISTRE</div>
            <div className="brand-sub">de Lomone</div>
          </span>
        </div>
        <div className="hub-account">
          <span className="small muted">
            Connecté : <strong data-testid="account-name">{account.name}</strong>
          </span>
          <form action={logout}>
            <button className="btn btn-small btn-ghost" type="submit">
              <LogOut size={14} /> Se déconnecter
            </button>
          </form>
        </div>
      </header>

      <main className="content hub-content">
        <div className="page-head">
          <div className="eyebrow">✦ Registre de Lomone ✦</div>
          <h1>Mes boutiques</h1>
          <p className="muted">
            Choisis la boutique où entrer.
          </p>
        </div>

        {shops.length > 0 && (
          <nav aria-label="Mes boutiques" className="section-gap">
            <ul className="shop-grid">
              {shops.map((shop) => (
                <li key={shop.id}>
                  <article className="shop-card" aria-labelledby={`shop-${shop.id}`}>
                    <div className="shop-card-head">
                      <Store size={22} className="shop-card-icon" aria-hidden="true" />
                      <span className={`badge ${shop.role === "gerant" ? "badge-gold" : "badge-blue"}`}>
                        {ROLE_LABELS[shop.role]}
                      </span>
                    </div>
                    <h2 id={`shop-${shop.id}`}>{shop.name}</h2>
                    <p className="small muted shop-card-meta">
                      <span>/{shop.slug}</span>
                      <span>
                        <Users size={12} aria-hidden="true" /> {shop.members} {shop.members > 1 ? "membres" : "membre"}
                      </span>
                    </p>
                    <div className="shop-card-actions">
                      <Link className="btn btn-small btn-enter" href={shopPath(shop.slug)} aria-label={`Entrer dans ${shop.name}`}>
                        <DoorOpen size={14} /> Entrer
                      </Link>
                      {shop.role === "gerant" && (
                        <Link
                          className="btn btn-small btn-ghost"
                          href={shopPath(shop.slug, "/reglages")}
                          aria-label={`Réglages de ${shop.name}`}
                        >
                          <Settings size={14} /> Réglages
                        </Link>
                      )}
                    </div>
                  </article>
                </li>
              ))}
            </ul>
          </nav>
        )}

        {canOpenShop(account) ? (
          <div className="cols">
            <section className="panel" aria-labelledby="open-shop">
              <div className="eyebrow">Super admin</div>
              <h2 id="open-shop">Ouvrir une boutique</h2>
              <p className="small muted">
                Tu en seras le gérant, et tu pourras y créer les comptes de ses employés. Son adresse vient de son nom.
              </p>
              <OpenShopForm />
            </section>
            <section className="panel" aria-labelledby="invite-gerant">
              <div className="eyebrow">Super admin</div>
              <h2 id="invite-gerant">Ouvrir une boutique pour quelqu&apos;un</h2>
              <p className="small muted">
                Tu reçois un lien à lui donner : en l&apos;ouvrant, il en devient le gérant, avec son compte ou un
                nouveau. Chaque lien ne sert qu&apos;une fois.
              </p>
              <InviteGerantForm />
            </section>
          </div>
        ) : (
          <p className="small muted">Pour ouvrir une nouvelle boutique, demande au super admin.</p>
        )}

        {invitations.length > 0 && (
          <section className="panel" aria-labelledby="pending-invitations" style={{ marginTop: 22 }}>
            <h2 id="pending-invitations">Invitations en attente</h2>
            <p className="small muted">Ces boutiques attendent leur gérant : donne-lui le lien.</p>
            <ul className="invitation-list">
              {invitations.map((invitation) => (
                <li key={invitation.id}>
                  <div>
                    <strong>{invitation.shopName}</strong>
                    <div className="small muted">
                      /{invitation.shopSlug} · créée le {longDate.format(invitation.createdAt)}
                    </div>
                  </div>
                  <InvitationLink path={invitationPath(invitation.token)} label={`Lien d'invitation de ${invitation.shopName}`} />
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
      <footer className="footer">✦ Registre de Lomone · Keizaal ✦</footer>
    </div>
  );
}
