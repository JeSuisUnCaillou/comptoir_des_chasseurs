import { Coins, ShoppingBasket, Wallet } from "lucide-react";
import Link from "next/link";
import { PageHead } from "@/components/page-head";
import { Pagination } from "@/components/pagination";
import { RegisterTable } from "@/components/register-table";
import { TillStat } from "@/components/till-stat";
import { requireMember } from "@/lib/auth/session";
import type { TransactionKind } from "@/lib/db/schema";
import { septims } from "@/lib/pricing";
import { PAGE_SIZE, offsetOf, pageParam, param } from "@/lib/pagination";
import { CASH_KINDS, isCashKind, signedAmount } from "@/lib/transaction-kinds";
import {
  dayParam,
  parisDay,
  registerAuthors,
  registerCount,
  registerEntries,
  tillTotals,
  type RegisterFilter,
} from "@/lib/register";

type Search = Record<"type" | "employe" | "du" | "au" | "page" | "inscrit", string | string[] | undefined>;

const PATH = "/achat-vente";

/** What the "Opération" filter offers, and the kinds of lines each shows. */
const OPERATIONS = {
  vente: ["vente"],
  rachat: ["rachat"],
  caisse: [...CASH_KINDS],
} satisfies Record<string, TransactionKind[]>;

function asOperation(value: string | undefined) {
  return value && Object.hasOwn(OPERATIONS, value) ? (value as keyof typeof OPERATIONS) : undefined;
}

export default async function AchatVente({ searchParams }: { searchParams: Promise<Search> }) {
  const member = await requireMember();
  const search = await searchParams;
  const operation = asOperation(param(search.type));
  let du = dayParam(param(search.du));
  let au = dayParam(param(search.au));
  if (du && au && du > au) [du, au] = [au, du]; // a reversed range still means something
  const page = pageParam(search.page);
  const authors = await registerAuthors();
  const author = authors.find((a) => String(a.id) === param(search.employe));
  const employe = author && String(author.id);
  const filters = { type: operation, employe, du, au };
  const filter: RegisterFilter = {
    kinds: operation && OPERATIONS[operation],
    memberId: author?.id,
    from: parisDay(du),
    to: parisDay(au, 1), // "au" includes that day
  };

  const [entries, total, totals] = await Promise.all([
    registerEntries(filter, { limit: PAGE_SIZE, offset: offsetOf(page) }),
    registerCount(filter),
    tillTotals(filter),
  ]);
  const filtered = Boolean(operation || employe || du || au);
  // Coming back from the entry form: confirm the line just written.
  const writtenId = Number(param(search.inscrit));
  const written = entries.find((e) => e.id === writtenId);

  return (
    <>
      <PageHead title="Achat / Vente" />
      <div className="big-actions">
        <Link className="big-action" href={`${PATH}/achat`}>
          <ShoppingBasket size={28} />
          <span>
            <strong>Nouvel achat</strong>
            <span className="small muted">On paie un vendeur, la marchandise entre en stock.</span>
          </span>
        </Link>
        <Link className="big-action" href={`${PATH}/vente`}>
          <Coins size={28} />
          <span>
            <strong>Nouvelle vente</strong>
            <span className="small muted">Un client paie, la marchandise sort du stock.</span>
          </span>
        </Link>
        <Link className="big-action" href={`${PATH}/caisse`}>
          <Wallet size={28} />
          <span>
            <strong>Mouvement de caisse</strong>
            <span className="small muted">Des septims entrent ou sortent, sans marchandise.</span>
          </span>
        </Link>
      </div>

      {written && (
        <p className="notice" role="status">
          {isCashKind(written.kind) ? (
            <>
              Mouvement inscrit : {written.label},{" "}
              {septims(signedAmount(written.kind, written.amount), { signed: true })}.
            </>
          ) : (
            <>
              {written.kind === "vente" ? "Vente inscrite" : "Achat inscrit"} : {written.quantity} × {written.label},{" "}
              {septims(written.amount)}.
            </>
          )}
        </p>
      )}
      <section className="panel" aria-labelledby="registre">
        <div className="eyebrow">Toutes les écritures</div>
        <h2 id="registre">Registre des achats, ventes et mouvements de caisse</h2>
        {/* Keyed on the filters so "Tout afficher" resets the fields, which keep their value across client navigation. */}
        <form key={JSON.stringify(filters)} className="inline-form filters" method="get" action={PATH} aria-label="Filtrer le registre">
          <label className="small muted" htmlFor="r-type">
            Opération
          </label>
          <select id="r-type" name="type" defaultValue={operation ?? ""}>
            <option value="">Toutes</option>
            <option value="vente">Ventes</option>
            <option value="rachat">Achats</option>
            <option value="caisse">Mouvements de caisse</option>
          </select>
          <label className="small muted" htmlFor="r-employe">
            Employé
          </label>
          <select id="r-employe" name="employe" defaultValue={employe ?? ""}>
            <option value="">Tous</option>
            {authors.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <label className="small muted" htmlFor="r-du">
            Du
          </label>
          <input id="r-du" name="du" type="date" defaultValue={du ?? ""} />
          <label className="small muted" htmlFor="r-au">
            Au
          </label>
          <input id="r-au" name="au" type="date" defaultValue={au ?? ""} />
          <button className="btn btn-small" type="submit">
            Filtrer
          </button>
          {filtered && (
            <Link className="btn btn-small btn-ghost" href={PATH}>
              Tout afficher
            </Link>
          )}
        </form>
        <div className="stats">
          <TillStat title={filtered ? "Caisse sur la sélection" : "Caisse depuis l'ouverture"} till={totals} testId="totaux-registre" />
        </div>
        <p className="small muted">Les lignes annulées sont barrées et ne comptent pas dans la caisse.</p>
        <RegisterTable entries={entries} member={member} highlight={written?.id} />
        <Pagination page={page} total={total} path={PATH} params={filters} label="Pages du registre" />
      </section>
    </>
  );
}
