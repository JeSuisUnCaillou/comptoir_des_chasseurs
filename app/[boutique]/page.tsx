import { ArrowLeftRight, Coins, Megaphone, ShoppingBasket, Wallet } from "lucide-react";
import Link from "next/link";
import { AnnouncementBoard } from "@/components/announcement-board";
import { PageHead } from "@/components/page-head";
import { RegisterTable } from "@/components/register-table";
import { ShopSetup } from "@/components/shop-setup";
import { TillOverview } from "@/components/till-overview";
import { WeekEndButton } from "@/components/week-end-button";
import { requireMember } from "@/lib/auth/session";
import { isGerant } from "@/lib/policies";
import { shopPath } from "@/lib/paths";
import { announcementList } from "@/lib/announcements";
import { registerEntries, tillSummary } from "@/lib/register";
import { shopSetup } from "@/lib/shop-setup";

const weekEndDate = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "full",
  timeStyle: "short",
  timeZone: "Europe/Paris",
});

export default async function GrandLivre() {
  const member = await requireMember();
  const at = (path: string) => shopPath(member.shop.slug, path);
  const [till, recent, announcements, setup] = await Promise.all([
    tillSummary(member.shopId),
    registerEntries(member.shopId, {}, { limit: 10 }),
    announcementList(member.shopId),
    // A new shop with nothing in stock is offered to its gérants to set up.
    isGerant(member) ? shopSetup(member.shop) : null,
  ]);

  return (
    <>
      <PageHead title="Grand livre" />
      {setup && <ShopSetup tillDone={setup.tillDone} />}
      <section className="panel">
        <div className="panel-head">
          <div>
            <div className="eyebrow">La caisse de la boutique</div>
            <h2>Bonjour, {member.name}</h2>
          </div>
          <div className="move-actions">
            <Link className="btn" href={at("/achat-vente/caisse")}>
              <Wallet size={16} /> Mouvement de caisse
            </Link>
            <Link className="btn" href={at("/inventaire/mouvement")}>
              <ArrowLeftRight size={16} /> Mouvement de stock
            </Link>
            <Link className="btn btn-primary" href={at("/achat-vente/achat")}>
              <ShoppingBasket size={16} /> Nouvel achat
            </Link>
            <Link className="btn btn-primary" href={at("/achat-vente/vente")}>
              <Coins size={16} /> Nouvelle vente
            </Link>
          </div>
        </div>
        <TillOverview week={till.week} all={till.all} days={till.days} allDays={till.allDays} />
        <div className="week-end">
          <p className="small muted" data-testid="fin-de-semaine">
            {till.weekEnd
              ? `Depuis la fin de semaine déclarée par ${till.weekEnd.by} le ${weekEndDate.format(till.weekEnd.declaredAt)}.`
              : "Depuis l'ouverture : aucune fin de semaine n'a encore été déclarée."}
          </p>
          {isGerant(member) && <WeekEndButton />}
        </div>
      </section>
      <section className="section-gap">
        <div className="panel-head">
          <div>
            <div className="eyebrow">Affichage de la boutique</div>
            <h2>
              <Megaphone size={18} style={{ verticalAlign: "-2px" }} /> Tableau d&apos;annonces
            </h2>
            <p className="muted" style={{ margin: "4px 0 0" }}>
              Les annonces laissées par les membres de la boutique.
            </p>
          </div>
          <Link className="btn btn-small" href={at("/annonces")}>
            <Megaphone size={14} /> Afficher un parchemin
          </Link>
        </div>
        <AnnouncementBoard announcements={announcements} member={member} back={at("/")} />
      </section>
      <section className="panel">
        <div className="panel-head">
          <h2>Dernières écritures</h2>
          <Link className="small" href={at("/achat-vente")}>
            Tout le registre →
          </Link>
        </div>
        <RegisterTable entries={recent} member={member} showNotes={false} />
      </section>
    </>
  );
}
