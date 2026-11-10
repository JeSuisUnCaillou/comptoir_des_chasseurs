import { Coins, Megaphone, ShoppingBasket, Wallet } from "lucide-react";
import Link from "next/link";
import { AnnouncementBoard } from "@/components/announcement-board";
import { PageHead } from "@/components/page-head";
import { RegisterTable } from "@/components/register-table";
import { TillStat } from "@/components/till-stat";
import { requireMember } from "@/lib/auth/session";
import { announcementList } from "@/lib/announcements";
import { registerEntries, tillSummary } from "@/lib/register";

export default async function GrandLivre() {
  const member = await requireMember();
  const [till, recent, announcements] = await Promise.all([
    tillSummary(),
    registerEntries({}, { limit: 10 }),
    announcementList(),
  ]);

  return (
    <>
      <PageHead title="Grand livre" />
      <section className="panel">
        <div className="panel-head">
          <div>
            <div className="eyebrow">La caisse du comptoir</div>
            <h2>Bonjour, {member.name}</h2>
          </div>
          <div className="move-actions">
            <Link className="btn" href="/achat-vente/achat">
              <ShoppingBasket size={16} /> Nouvel achat
            </Link>
            <Link className="btn btn-primary" href="/achat-vente/vente">
              <Coins size={16} /> Nouvelle vente
            </Link>
            <Link className="btn" href="/achat-vente/caisse">
              <Wallet size={16} /> Mouvement de caisse
            </Link>
          </div>
        </div>
        <div className="stats">
          <TillStat title="Aujourd'hui" till={till.day} testId="caisse-jour" />
          <TillStat title="7 derniers jours" till={till.week} testId="caisse-semaine" />
          <TillStat title="Depuis l'ouverture" till={till.all} testId="caisse-totale" />
        </div>
      </section>
      <section className="section-gap">
        <div className="panel-head">
          <div>
            <div className="eyebrow">Affichage du comptoir</div>
            <h2>
              <Megaphone size={18} style={{ verticalAlign: "-2px" }} /> Tableau d&apos;annonces
            </h2>
            <p className="muted" style={{ margin: "4px 0 0" }}>
              Les annonces laissées par les membres du comptoir.
            </p>
          </div>
          <Link className="btn btn-small" href="/annonces">
            <Megaphone size={14} /> Afficher un parchemin
          </Link>
        </div>
        <AnnouncementBoard announcements={announcements} member={member} />
      </section>
      <section className="panel">
        <div className="panel-head">
          <h2>Dernières écritures</h2>
          <Link className="small" href="/achat-vente">
            Tout le registre →
          </Link>
        </div>
        <RegisterTable entries={recent} member={member} showNotes={false} />
      </section>
    </>
  );
}
