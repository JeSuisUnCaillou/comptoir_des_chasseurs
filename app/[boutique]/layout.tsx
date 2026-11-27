import type { Metadata } from "next";
import type { ReactNode } from "react";
import {
  Archive,
  ArrowLeftRight,
  Contact,
  KeyRound,
  LayoutGrid,
  LogOut,
  Megaphone,
  ScrollText,
  Settings,
  Shield,
  Store,
  Tag,
  Users,
} from "lucide-react";
import Link from "next/link";
import { BrandMark } from "@/components/brand";
import { NavLink } from "@/components/nav-link";
import { logout } from "@/app/connexion/actions";
import { requireMember } from "@/lib/auth/session";
import { APP_LOGO, shopLogoPath } from "@/lib/logo";
import { shopPath } from "@/lib/paths";
import { isGerant } from "@/lib/policies";
import { shopLogoVersion } from "@/lib/shop-logos";
import { currentShop } from "@/lib/shops";
import { ToSettleNotice } from "@/components/to-settle-notice";
import { pendingTotals, stockReminderCount } from "@/lib/register";

export const dynamic = "force-dynamic";

/** Browser tab: the shop's name and logo, on every page of the shop. */
export async function generateMetadata(): Promise<Metadata> {
  const shop = await currentShop();
  const logo = await shopLogoVersion(shop.id);
  const icon = logo === null ? { url: APP_LOGO, type: "image/svg+xml" } : { url: shopLogoPath(shop.slug, logo), type: "image/png" };
  return { title: shop.name, icons: { icon } };
}

export default async function ShopLayout({ children }: { children: ReactNode }) {
  const member = await requireMember();
  const gerant = isGerant(member);
  const at = (path: string) => shopPath(member.shop.slug, path);
  const [logoVersion, mine, stock] = await Promise.all([
    shopLogoVersion(member.shopId),
    // What the member still has to settle, said at the top of every page: septims, merchandise.
    pendingTotals(member.shopId, { memberId: member.id }),
    stockReminderCount(member.shopId, member.id),
  ]);
  const logo = shopLogoPath(member.shop.slug, logoVersion);
  const notice = <ToSettleNotice mine={mine} stock={stock} href={at("/a-regler")} />;

  return (
    <div className="shell">
      <aside className="sidebar">
        <Link href={at("/")} className="brand">
          <BrandMark src={logo} />
          <span>
            <div className="brand-name">CODEX</div>
            <div className="brand-sub">Enchanté par Lomone</div>
          </span>
        </Link>
        <div className="eyebrow nav-title">✦ Le registre ✦</div>
        <nav className="nav" aria-label="Menu principal">
          <NavLink href={at("/")} exact>
            <LayoutGrid size={18} /> Grand livre
          </NavLink>
          <NavLink href={at("/achat-vente")}>
            <ArrowLeftRight size={18} /> Achat / Vente
          </NavLink>
          <NavLink href={at("/tarifs")} also={[at("/marchandises")]}>
            <Tag size={18} /> Tarifs
          </NavLink>
          <NavLink href={at("/inventaire")}>
            <Archive size={18} /> Inventaire
          </NavLink>
          <NavLink href={at("/contrats")}>
            <ScrollText size={18} /> Contrats
          </NavLink>
          <NavLink href={at("/contacts")}>
            <Contact size={18} /> Contacts
          </NavLink>
          <NavLink href={at("/annonces")}>
            <Megaphone size={18} /> Annonces
          </NavLink>
          {gerant && (
            <NavLink href={at("/membres")}>
              <Users size={18} /> Membres
            </NavLink>
          )}
          {gerant && (
            <NavLink href={at("/reglages")}>
              <Settings size={18} /> Réglages
            </NavLink>
          )}
          <Link className="nav-shops" href="/boutiques">
            <Store size={18} /> Changer de boutique
          </Link>
        </nav>
        <div className="sidebar-foot">
          <Shield size={14} style={{ verticalAlign: "-2px" }} />{" "}
          {gerant ? "Connecté en gérant" : "Connecté en employé"}
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <span className="eyebrow" data-testid="shop-name">
            {member.shop.name}
          </span>
          <div className="topbar-notice">{notice}</div>
          <div className="topbar-user">
            <Link className="topbar-name" href={at(`/membres/${member.id}`)} title="Voir mon activité" data-testid="member-name">
              {member.name}
            </Link>
            <Link className="icon-btn" href={at("/mot-de-passe")} title="Changer mon mot de passe" aria-label="Changer mon mot de passe">
              <KeyRound size={20} />
            </Link>
            <form action={logout}>
              <button className="icon-btn" type="submit" title="Se déconnecter" aria-label="Se déconnecter">
                <LogOut size={20} />
              </button>
            </form>
          </div>
        </header>
        <main className="content">
          <div className="content-notice">{notice}</div>
          {children}
        </main>
        <footer className="footer">✦ Codex enchanté ✦</footer>
      </div>
    </div>
  );
}
