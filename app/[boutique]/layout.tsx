import type { ReactNode } from "react";
import {
  Archive,
  ArrowLeftRight,
  KeyRound,
  LayoutGrid,
  LogOut,
  Megaphone,
  Shield,
  Tag,
  Truck,
  Users,
} from "lucide-react";
import Link from "next/link";
import { BrandMark } from "@/components/brand";
import { NavLink } from "@/components/nav-link";
import { logout } from "@/app/connexion/actions";
import { requireMember } from "@/lib/auth/session";
import { shopPath } from "@/lib/paths";
import { isGerant } from "@/lib/policies";

export const dynamic = "force-dynamic";

export default async function ComptoirLayout({ children }: { children: ReactNode }) {
  const member = await requireMember();
  const gerant = isGerant(member);
  const at = (path: string) => shopPath(member.shop.slug, path);

  return (
    <div className="shell">
      <aside className="sidebar">
        <Link href={at("/")} className="brand">
          <BrandMark />
          <span>
            <div className="brand-name">COMPTOIR</div>
            <div className="brand-sub">de chasse · Keizaal</div>
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
          <NavLink href={at("/fournisseurs")}>
            <Truck size={18} /> Fournisseurs
          </NavLink>
          <NavLink href={at("/annonces")}>
            <Megaphone size={18} /> Annonces
          </NavLink>
          {gerant && (
            <NavLink href={at("/membres")}>
              <Users size={18} /> Membres
            </NavLink>
          )}
        </nav>
        <div className="sidebar-foot">
          <Shield size={14} style={{ verticalAlign: "-2px" }} />{" "}
          {gerant ? "Gérance du comptoir" : "Personnel du comptoir"}
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <span className="eyebrow">
            <span data-testid="shop-name">{member.shop.name}</span>
            {" · "}
            <Link href="/boutiques">Mes boutiques</Link>
          </span>
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
        <main className="content">{children}</main>
        <footer className="footer">✦ Comptoir de chasse · Keizaal ✦</footer>
      </div>
    </div>
  );
}
