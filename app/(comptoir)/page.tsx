import { Coins, ShoppingBasket } from "lucide-react";
import Link from "next/link";
import { PageHead } from "@/components/page-head";
import { RegisterTable } from "@/components/register-table";
import { requireMember } from "@/lib/auth/session";
import { septims } from "@/lib/pricing";
import { parisDay, parisToday, registerEntries, tillTotals } from "@/lib/register";

function Till({ title, totals, testId }: { title: string; totals: Awaited<ReturnType<typeof tillTotals>>; testId: string }) {
  return (
    <div className="stat" data-testid={testId}>
      <div className="stat-label">{title}</div>
      <div className={`stat-value ${totals.balance >= 0 ? "plus" : "minus"}`}>
        {septims(totals.balance, { signed: true })}
      </div>
      <div className="small muted">
        {septims(totals.sales)} encaissés · {septims(totals.buybacks)} payés
      </div>
    </div>
  );
}

export default async function GrandLivre() {
  const member = await requireMember();
  const today = parisToday();
  const [day, week, all, recent] = await Promise.all([
    tillTotals({ from: parisDay(today) }),
    tillTotals({ from: parisDay(today, -6) }),
    tillTotals(),
    registerEntries({}, 10),
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
            <Link className="btn btn-primary" href="/vente">
              <Coins size={16} /> Nouvelle vente
            </Link>
            <Link className="btn" href="/rachat">
              <ShoppingBasket size={16} /> Nouveau rachat
            </Link>
          </div>
        </div>
        <div className="stats">
          <Till title="Aujourd'hui" totals={day} testId="caisse-jour" />
          <Till title="7 derniers jours" totals={week} testId="caisse-semaine" />
          <Till title="Depuis l'ouverture" totals={all} testId="caisse-totale" />
        </div>
      </section>
      <section className="panel">
        <div className="panel-head">
          <h2>Dernières écritures</h2>
          <Link className="small" href="/registre">
            Tout le registre →
          </Link>
        </div>
        <RegisterTable entries={recent} member={member} showNotes={false} />
      </section>
    </>
  );
}
