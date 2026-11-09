import { Coins, ShoppingBasket } from "lucide-react";
import Link from "next/link";
import { PageHead } from "@/components/page-head";
import { RegisterTable } from "@/components/register-table";
import { TillStat } from "@/components/till-stat";
import { requireMember } from "@/lib/auth/session";
import { registerEntries, tillSummary } from "@/lib/register";

export default async function GrandLivre() {
  const member = await requireMember();
  const [till, recent] = await Promise.all([tillSummary(), registerEntries({}, { limit: 10 })]);

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
          </div>
        </div>
        <div className="stats">
          <TillStat title="Aujourd'hui" till={till.day} testId="caisse-jour" />
          <TillStat title="7 derniers jours" till={till.week} testId="caisse-semaine" />
          <TillStat title="Depuis l'ouverture" till={till.all} testId="caisse-totale" />
        </div>
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
