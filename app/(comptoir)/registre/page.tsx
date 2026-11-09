import { ScrollText } from "lucide-react";
import Link from "next/link";
import { PageHead } from "@/components/page-head";
import { RegisterTable } from "@/components/register-table";
import { requireMember } from "@/lib/auth/session";
import type { TransactionKind } from "@/lib/db/schema";
import { septims } from "@/lib/pricing";
import { parisDay, registerEntries, tillTotals, type RegisterFilter } from "@/lib/register";

const LIMIT = 200;

type Search = { type?: string; du?: string; au?: string };

export default async function Registre({ searchParams }: { searchParams: Promise<Search> }) {
  const member = await requireMember();
  const search = await searchParams;
  const kind: TransactionKind | undefined =
    search.type === "vente" || search.type === "rachat" ? search.type : undefined;
  const filter: RegisterFilter = {
    kind,
    from: parisDay(search.du),
    to: parisDay(search.au, 1), // "au" includes that whole day
  };
  const [entries, totals] = await Promise.all([registerEntries(filter, LIMIT), tillTotals(filter)]);

  return (
    <>
      <PageHead title="Registre" />
      <section className="panel">
        <div className="eyebrow">Toutes les écritures</div>
        <h2>
          <ScrollText size={18} style={{ verticalAlign: "-2px" }} /> Registre des ventes et rachats
        </h2>
        <form className="inline-form filters" method="get" aria-label="Filtrer le registre">
          <label className="small muted" htmlFor="r-type">
            Opération
          </label>
          <select id="r-type" name="type" defaultValue={kind ?? ""}>
            <option value="">Toutes</option>
            <option value="vente">Ventes</option>
            <option value="rachat">Rachats</option>
          </select>
          <label className="small muted" htmlFor="r-du">
            Du
          </label>
          <input id="r-du" name="du" type="date" defaultValue={search.du ?? ""} />
          <label className="small muted" htmlFor="r-au">
            Au
          </label>
          <input id="r-au" name="au" type="date" defaultValue={search.au ?? ""} />
          <button className="btn btn-small" type="submit">
            Filtrer
          </button>
          {(kind || search.du || search.au) && (
            <Link className="btn btn-small btn-ghost" href="/registre">
              Tout afficher
            </Link>
          )}
        </form>
        <div className="stats" data-testid="totaux-registre">
          <div className="stat">
            <div className="stat-label">Ventes encaissées</div>
            <div className="stat-value plus">{septims(totals.sales)}</div>
          </div>
          <div className="stat">
            <div className="stat-label">Rachats payés</div>
            <div className="stat-value minus">{septims(totals.buybacks)}</div>
          </div>
          <div className="stat">
            <div className="stat-label">Solde de la caisse</div>
            <div className={`stat-value ${totals.balance >= 0 ? "plus" : "minus"}`}>
              {septims(totals.balance, { signed: true })}
            </div>
          </div>
        </div>
        <p className="small muted">
          Les lignes annulées sont barrées et ne comptent pas dans les totaux.
          {entries.length === LIMIT && ` Seules les ${LIMIT} dernières écritures sont affichées.`}
        </p>
      </section>
      <section className="panel">
        <RegisterTable entries={entries} member={member} />
      </section>
    </>
  );
}
