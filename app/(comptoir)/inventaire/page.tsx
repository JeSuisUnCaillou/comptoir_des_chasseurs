import { Archive } from "lucide-react";
import Link from "next/link";
import { LiveSearch } from "@/components/live-search";
import { PageHead } from "@/components/page-head";
import { StockBoard } from "@/components/stock-board";
import { requireMember } from "@/lib/auth/session";
import type { ProductCategory } from "@/lib/db/schema";
import { formatNumber, plural } from "@/lib/pricing";
import { Pagination } from "@/components/pagination";
import { PAGE_SIZE, offsetOf, pageParam, param } from "@/lib/pagination";
import { activeProducts, movementCount, recentMovements, type MovementFilter } from "@/lib/products";
import { dayParam, parisDay, registerAuthors } from "@/lib/register";

type Search = Record<"q" | "employe" | "sens" | "du" | "au" | "page", string | string[] | undefined>;

const PATH = "/inventaire";

/** What the "Mouvement" filter offers, and the direction each keeps. */
const DIRECTIONS = { entree: "in", sortie: "out" } as const satisfies Record<string, MovementFilter["direction"]>;

function asDirection(value: string | undefined) {
  return value && Object.hasOwn(DIRECTIONS, value) ? (value as keyof typeof DIRECTIONS) : undefined;
}

// Meats first, then hides, then everything else; the database already sorts by
// name and Array.prototype.sort is stable, so names stay in order inside each group.
const STOCK_GROUP: Partial<Record<ProductCategory, number>> = { viande: 0, peau: 1 };
const stockGroup = (category: ProductCategory) => STOCK_GROUP[category] ?? 2;

const dateTime = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Europe/Paris",
});

export default async function Inventaire({ searchParams }: { searchParams: Promise<Search> }) {
  await requireMember();
  const search = await searchParams;
  const page = pageParam(search.page);
  const q = (param(search.q) ?? "").trim().slice(0, 100) || undefined;
  const sens = asDirection(param(search.sens));
  let du = dayParam(param(search.du));
  let au = dayParam(param(search.au));
  if (du && au && du > au) [du, au] = [au, du]; // a reversed range still means something
  const authors = await registerAuthors();
  const author = authors.find((a) => String(a.id) === param(search.employe));
  const employe = author && String(author.id);
  const filters = { q, employe, sens, du, au };
  const filter: MovementFilter = {
    q,
    memberId: author?.id,
    direction: sens && DIRECTIONS[sens],
    from: parisDay(du),
    to: parisDay(au, 1), // "au" includes that day
  };
  const filtered = Boolean(q || employe || sens || du || au);
  const [products, movements, total] = await Promise.all([
    activeProducts(),
    recentMovements(filter, { limit: PAGE_SIZE, offset: offsetOf(page) }),
    movementCount(filter),
  ]);
  const sum = (category: string) =>
    products.filter((p) => p.category === category).reduce((total, p) => total + p.stock, 0);
  const others = products.filter((p) => p.category !== "peau" && p.category !== "cuir").length;

  return (
    <>
      <PageHead title="Inventaire" />
      <section className="panel">
        <div className="eyebrow">Réserves du comptoir</div>
        <h2>
          <Archive size={18} style={{ verticalAlign: "-2px" }} /> Inventaire des marchandises
        </h2>
        <p className="muted">Entrées, sorties et quantités disponibles dans les réserves.</p>
        <div className="stats">
          <div className="stat">
            <div className="stat-label">Peaux en réserve</div>
            <div className="stat-value" data-testid="total-peaux">
              {formatNumber(sum("peau"))}
            </div>
          </div>
          <div className="stat">
            <div className="stat-label">Cuirs en réserve</div>
            <div className="stat-value" data-testid="total-cuirs">
              {formatNumber(sum("cuir"))}
            </div>
          </div>
          <div className="stat">
            <div className="stat-label">Autres références</div>
            <div className="stat-value">{formatNumber(others)}</div>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Stock disponible</h2>
          <span className="small muted">{products.length} référence(s)</span>
        </div>
        <StockBoard
          items={[...products]
            .sort((a, b) => stockGroup(a.category) - stockGroup(b.category))
            .map(({ id, name, category, unit, stock }) => ({ id, name, category, unit, stock }))}
        />
      </section>

      <section className="panel" aria-labelledby="historique-titre">
        <div className="panel-head">
          <h2 id="historique-titre">Historique des mouvements</h2>
          <span className="small muted" data-testid="historique-total">
            {total} mouvement(s)
          </span>
        </div>
        <p className="muted">Les entrées et sorties, des plus récentes aux plus anciennes, avec leur auteur et leur motif.</p>
        <LiveSearch />
        {/* Keyed on the filters so "Tout afficher" resets the fields, which keep their value across client navigation. */}
        <form key={JSON.stringify(filters)} className="inline-form filters" method="get" action={PATH} aria-label="Filtrer l'historique">
          {q && <input type="hidden" name="q" value={q} />}
          <label className="small muted" htmlFor="h-employe">
            Employé
          </label>
          <select id="h-employe" name="employe" defaultValue={employe ?? ""}>
            <option value="">Tous</option>
            {authors.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <label className="small muted" htmlFor="h-sens">
            Mouvement
          </label>
          <select id="h-sens" name="sens" defaultValue={sens ?? ""}>
            <option value="">Tous</option>
            <option value="entree">Entrées</option>
            <option value="sortie">Sorties</option>
          </select>
          <label className="small muted" htmlFor="h-du">
            Du
          </label>
          <input id="h-du" name="du" type="date" defaultValue={du ?? ""} />
          <label className="small muted" htmlFor="h-au">
            Au
          </label>
          <input id="h-au" name="au" type="date" defaultValue={au ?? ""} />
          <button className="btn btn-small" type="submit">
            Filtrer
          </button>
          {filtered && (
            <Link className="btn btn-small btn-ghost" href={PATH}>
              Tout afficher
            </Link>
          )}
        </form>
        {movements.length === 0 ? (
          <p className="muted">{filtered ? "Aucun mouvement ne correspond." : "Aucun mouvement pour l'instant."}</p>
        ) : (
          <div className="table-wrap">
            <table data-testid="historique">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Marchandise</th>
                  <th className="num">Mouvement</th>
                  <th className="num">Stock après</th>
                  <th>Employé</th>
                  <th>Motif</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => (
                  <tr key={m.id}>
                    <td className="num">{dateTime.format(m.createdAt)}</td>
                    <td>{m.product}</td>
                    <td className={`num ${m.delta > 0 ? "plus" : "minus"}`}>
                      {m.delta > 0 ? "+" : "−"}
                      {formatNumber(Math.abs(m.delta))}
                    </td>
                    <td className="num">
                      {formatNumber(m.stockAfter)} {plural(m.unit, m.stockAfter)}
                    </td>
                    <td>{m.member}</td>
                    <td>{m.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={page} total={total} path={PATH} params={filters} label="Pages de l'historique" />
      </section>
    </>
  );
}
