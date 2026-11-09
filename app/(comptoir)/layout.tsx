import type { ReactNode } from "react";
import {
  Archive,
  ArrowLeftRight,
  KeyRound,
  LayoutGrid,
  LogOut,
  Megaphone,
  Package,
  Shield,
  Tag,
  Users,
} from "lucide-react";
import Link from "next/link";
import { BrandMark } from "@/components/brand";
import { NavLink } from "@/components/nav-link";
import { logout } from "@/app/connexion/actions";
import { requireMember } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function ComptoirLayout({ children }: { children: ReactNode }) {
  const member = await requireMember();
  const gerant = member.role === "gerant";

  return (
    <div className="shell">
      <aside className="sidebar">
        <Link href="/" className="brand">
          <BrandMark />
          <span>
            <div className="brand-name">COMPTOIR</div>
            <div className="brand-sub">de chasse · Keizaal</div>
          </span>
        </Link>
        <div className="eyebrow nav-title">✦ Le registre ✦</div>
        <nav className="nav" aria-label="Menu principal">
          <NavLink href="/">
            <LayoutGrid size={18} /> Grand livre
          </NavLink>
          <NavLink href="/achat-vente">
            <ArrowLeftRight size={18} /> Achat / Vente
          </NavLink>
          <NavLink href="/tarifs">
            <Tag size={18} /> Tarifs
          </NavLink>
          <NavLink href="/inventaire">
            <Archive size={18} /> Inventaire
          </NavLink>
          {gerant && (
            <NavLink href="/marchandises">
              <Package size={18} /> Marchandises
            </NavLink>
          )}
          <NavLink href="/annonces">
            <Megaphone size={18} /> Annonces
          </NavLink>
          {gerant && (
            <NavLink href="/membres">
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
          <span className="eyebrow">Le comptoir de chasse</span>
          <div className="topbar-user">
            <span data-testid="member-name">{member.name}</span>
            <Link className="icon-btn" href="/mot-de-passe" title="Changer mon mot de passe" aria-label="Changer mon mot de passe">
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
