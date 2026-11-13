import { Archive, ArrowLeftRight } from "lucide-react";
import Link from "next/link";
import { LiveSearch } from "@/components/live-search";
import { MemberDateFilters } from "@/components/member-date-filters";
import { PageHead } from "@/components/page-head";
import { StockBoard } from "@/components/stock-board";
import { requireMember } from "@/lib/auth/session";
import { shopPath } from "@/lib/paths";
import { isGerant } from "@/lib/policies";
import type { ProductCategory } from "@/lib/db/schema";
import { MovementTable } from "@/components/movement-table";
import { formatNumber, septims } from "@/lib/pricing";
import { Pagination } from "@/components/pagination";
import { PAGE_SIZE, offsetOf, pageParam, param, searchParam } from "@/lib/pagination";
import { activeProducts, movementCount, recentMovements, type MovementFilter } from "@/lib/products";
import { dayRange, memberNames, tillTotals } from "@/lib/register";

type Search = Record<"q" | "employe" | "sens" | "du" | "au" | "page" | "inscrit", string | string[] | undefined>;


/** What the "Mouvement" filter offers, and the direction each keeps. */
const DIRECTIONS = { entree: "in", sortie: "out" } as const satisfies Record<string, MovementFilter["direction"]>;

function asDirection(value: string | undefined) {
  return value && Object.hasOwn(DIRECTIONS, value) ? (value as keyof typeof DIRECTIONS) : undefined;
}

// Leather first, then meats, then hides, then everything else; the database
// already sorts by name and Array.prototype.sort is stable, so names stay in
// order inside each group.
const STOCK_GROUP: Partial<Record<ProductCategory, number>> = { cuir: 0, viande: 1, peau: 2 };
const stockGroup = (category: ProductCategory) => STOCK_GROUP[category] ?? 3;

export default async function Inventaire({ searchParams }: { searchParams: Promise<Search> }) {
  const member = await requireMember();
  const at = (path: string) => shopPath(member.shop.slug, path);
  const PATH = at("/inventaire");
  const search = await searchParams;
  const page = pageParam(search.page);
  const q = searchParam(search.q) || undefined;
  const sens = asDirection(param(search.sens));
  const { du, au, from, to } = dayRange(param(search.du), param(search.au));
  const authors = await memberNames(member.shopId);
  const author = authors.find((a) => String(a.id) === param(search.employe));
  const employe = author && String(author.id);
  const filters = { q, employe, sens, du, au };
  const filter: MovementFilter = {
    q,
    memberId: author?.id,
    direction: sens && DIRECTIONS[sens],
    from,
    to,
  };
  const filtered = Boolean(q || employe || sens || du || au);
  const [products, movements, total, till] = await Promise.all([
    activeProducts(member.shopId),
    recentMovements(member.shopId, filter, { limit: PAGE_SIZE, offset: offsetOf(page) }),
    movementCount(member.shopId, filter),
    tillTotals(member.shopId),
  ]);
  const sum = (category: string) =>
    products.filter((p) => p.category === category).reduce((total, p) => total + p.stock, 0);
  const others = products.filter((p) => p.category !== "peau" && p.category !== "cuir").length;

  // Coming back from the Mouvement de stock form: confirm the movements just written, in the order they were typed.
  const writtenIds = (param(search.inscrit) ?? "").split(",").map(Number);
  const written = writtenIds.flatMap((id) => movements.filter((m) => m.id === id));

  return (
    <>
      <PageHead title="Inventaire" />
      {written.length > 0 && (
        <p className="notice" role="status">
          Mouvement de stock inscrit :{" "}
          {written.map((m) => `${m.delta > 0 ? "+" : "−"}${formatNumber(Math.abs(m.delta))} ${m.product}`).join(", ")}
          .
        </p>
      )}
      <section className="panel">
        <div className="panel-head">
          <div>
            <div className="eyebrow">Réserves de la boutique</div>
            <h2>
              <Archive size={18} style={{ verticalAlign: "-2px" }} /> Inventaire des marchandises
            </h2>
            <p className="muted" style={{ margin: "4px 0 0" }}>
              Ce qu&apos;on a en réserve, et ce qui entre et sort.
            </p>
          </div>
          <div className="move-actions">
            <Link className="btn btn-primary" href={at("/inventaire/mouvement")}>
              <ArrowLeftRight size={16} /> Mouvement de stock
            </Link>
          </div>
        </div>
        <div className="stats">
          <div className="stat stat-accent-gold" data-testid="caisse-inventaire">
            <div className="stat-label">Septims en caisse</div>
            <div className={`stat-value ${till.balance < 0 ? "minus" : ""}`}>{septims(till.balance)}</div>
          </div>
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
            <div className="stat-label">Autres marchandises</div>
            <div className="stat-value">{formatNumber(others)}</div>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Stock disponible</h2>
          <span className="small muted">{products.length} marchandise{products.length > 1 ? "s" : ""}</span>
        </div>
        <StockBoard
          canManage={isGerant(member)}
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
        <MemberDateFilters path={PATH} label="Filtrer l'historique" filters={filters} members={authors} employe={employe} du={du} au={au}>
          {q && <input type="hidden" name="q" value={q} />}
          <label className="small muted" htmlFor="h-sens">
            Mouvement
          </label>
          <select id="h-sens" name="sens" defaultValue={sens ?? ""}>
            <option value="">Tous</option>
            <option value="entree">Entrées</option>
            <option value="sortie">Sorties</option>
          </select>
        </MemberDateFilters>
        <MovementTable
          movements={movements}
          highlight={written.map((m) => m.id)}
          empty={filtered ? "Aucun mouvement ne correspond." : "Aucun mouvement pour l'instant."}
        />
        <Pagination page={page} total={total} path={PATH} params={filters} label="Pages de l'historique" />
      </section>
    </>
  );
}
