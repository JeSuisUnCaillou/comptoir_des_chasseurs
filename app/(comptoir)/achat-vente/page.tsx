import { Coins, ShoppingBasket, X } from "lucide-react";
import Link from "next/link";
import { PageHead } from "@/components/page-head";
import { Pagination } from "@/components/pagination";
import { RegisterTable } from "@/components/register-table";
import { TillStat } from "@/components/till-stat";
import { TransactionForm } from "@/components/transaction-form";
import { requireMember } from "@/lib/auth/session";
import type { TransactionKind } from "@/lib/db/schema";
import { PAGE_SIZE, offsetOf, pageParam, param } from "@/lib/pagination";
import { activeProducts } from "@/lib/products";
import { parisDay, registerCount, registerEntries, tillTotals, type RegisterFilter } from "@/lib/register";

type Search = Record<"saisie" | "type" | "du" | "au" | "page", string | string[] | undefined>;

const PATH = "/achat-vente";

function asKind(value: string | undefined): TransactionKind | undefined {
  return value === "vente" || value === "rachat" ? value : undefined;
}

function asDate(value: string | undefined) {
  return value && parisDay(value) ? value : undefined;
}

export default async function AchatVente({ searchParams }: { searchParams: Promise<Search> }) {
  const member = await requireMember();
  const search = await searchParams;
  const entry = asKind(param(search.saisie));
  const kind = asKind(param(search.type));
  let du = asDate(param(search.du));
  let au = asDate(param(search.au));
  if (du && au && du > au) [du, au] = [au, du]; // a reversed range still means something
  const page = pageParam(search.page);
  const filters = { type: kind, du, au };
  const filter: RegisterFilter = { kind, from: parisDay(du), to: parisDay(au, 1) }; // "au" includes that day

  const [entries, total, totals, products] = await Promise.all([
    registerEntries(filter, { limit: PAGE_SIZE, offset: offsetOf(page) }),
    registerCount(filter),
    tillTotals(filter),
    entry ? activeProducts() : [],
  ]);
  const filtered = Boolean(kind || du || au);
  const withFilters = (extra: Record<string, string>) => {
    const query = new URLSearchParams(extra);
    for (const [key, value] of Object.entries(filters)) if (value) query.set(key, value);
    return `${PATH}?${query}`;
  };

  return (
    <>
      <PageHead title="Achat / Vente" />
      <div className="big-actions">
        <Link
          className={`big-action${entry === "rachat" ? " active" : ""}`}
          href={withFilters({ saisie: "rachat" })}
          aria-current={entry === "rachat" ? "true" : undefined}
        >
          <ShoppingBasket size={28} />
          <span>
            <strong>Nouveau rachat</strong>
            <span className="small muted">On paie un vendeur, la marchandise entre en stock.</span>
          </span>
        </Link>
        <Link
          className={`big-action${entry === "vente" ? " active" : ""}`}
          href={withFilters({ saisie: "vente" })}
          aria-current={entry === "vente" ? "true" : undefined}
        >
          <Coins size={28} />
          <span>
            <strong>Nouvelle vente</strong>
            <span className="small muted">Un client paie, la marchandise sort du stock.</span>
          </span>
        </Link>
      </div>

      {entry && (
        <section
          className="panel"
          style={{ maxWidth: 760 }}
          aria-label={entry === "vente" ? "Inscrire une vente" : "Inscrire un rachat"}
        >
          <div className="panel-head">
            <div>
              <div className="eyebrow">Nouvelle écriture</div>
              <h2>{entry === "vente" ? "Inscrire une vente" : "Inscrire un rachat"}</h2>
            </div>
            <Link className="icon-btn" href={withFilters({})} aria-label="Fermer" title="Fermer">
              <X size={20} />
            </Link>
          </div>
          <TransactionForm
            key={entry}
            kind={entry}
            products={products.map((p) => ({
              id: p.id,
              name: p.name,
              category: p.category,
              unit: p.unit,
              stock: p.stock,
              buyPrice: p.buyPrice,
              buyQty: p.buyQty,
              sellPrice: p.sellPrice,
              sellQty: p.sellQty,
              bulkMin: p.bulkMin,
              bulkPrice: p.bulkPrice,
              bulkQty: p.bulkQty,
            }))}
          />
        </section>
      )}

      <section className="panel" aria-labelledby="registre">
        <div className="eyebrow">Toutes les écritures</div>
        <h2 id="registre">Registre des achats et ventes</h2>
        <form className="inline-form filters" method="get" action={PATH} aria-label="Filtrer le registre">
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
        <RegisterTable entries={entries} member={member} />
        <Pagination page={page} total={total} path={PATH} params={filters} label="Pages du registre" />
      </section>
    </>
  );
}
