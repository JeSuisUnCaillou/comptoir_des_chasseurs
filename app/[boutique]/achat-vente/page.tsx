import { Coins, ShoppingBasket, Wallet } from "lucide-react";
import Link from "next/link";
import { MemberDateFilters } from "@/components/member-date-filters";
import { PageHead } from "@/components/page-head";
import { Pagination } from "@/components/pagination";
import { RegisterTable } from "@/components/register-table";
import { TillStat } from "@/components/till-stat";
import { requireMember } from "@/lib/auth/session";
import { shopPath } from "@/lib/paths";
import { septims } from "@/lib/pricing";
import { PAGE_SIZE, offsetOf, pageParam, param } from "@/lib/pagination";
import { CASH_KINDS, isCashKind, signedAmount } from "@/lib/transaction-kinds";
import {
  dayRange,
  memberNames,
  pendingTotals,
  registerCount,
  registerEntries,
  tillTotals,
  type RegisterFilter,
} from "@/lib/register";

type Search = Record<"type" | "employe" | "du" | "au" | "page" | "inscrit", string | string[] | undefined>;


/** What the "Opération" filter offers, and the lines each shows. */
const OPERATIONS = {
  vente: { kinds: ["vente"] },
  rachat: { kinds: ["rachat"] },
  caisse: { kinds: [...CASH_KINDS] },
  attente: { tillPending: true },
} satisfies Record<string, Pick<RegisterFilter, "kinds" | "tillPending">>;

function asOperation(value: string | undefined) {
  return value && Object.hasOwn(OPERATIONS, value) ? (value as keyof typeof OPERATIONS) : undefined;
}

export default async function AchatVente({ searchParams }: { searchParams: Promise<Search> }) {
  const member = await requireMember();
  const at = (path: string) => shopPath(member.shop.slug, path);
  const PATH = at("/achat-vente");
  const search = await searchParams;
  const operation = asOperation(param(search.type));
  const { du, au, from, to } = dayRange(param(search.du), param(search.au));
  const page = pageParam(search.page);
  const authors = await memberNames(member.shopId);
  const author = authors.find((a) => String(a.id) === param(search.employe));
  const employe = author && String(author.id);
  const filters = { type: operation, employe, du, au };
  const filter: RegisterFilter = {
    ...(operation && OPERATIONS[operation]),
    memberId: author?.id,
    from,
    to,
  };

  const [entries, total, totals, waiting] = await Promise.all([
    registerEntries(member.shopId, filter, { limit: PAGE_SIZE, offset: offsetOf(page) }),
    registerCount(member.shopId, filter),
    tillTotals(member.shopId, filter),
    pendingTotals(member.shopId, filter),
  ]);
  const anyWaiting = waiting.sales > 0 || waiting.buybacks > 0;
  const filtered = Boolean(operation || employe || du || au);
  // Coming back from the entry form: confirm the lines just written, in the order they were typed.
  const writtenIds = (param(search.inscrit) ?? "").split(",").map(Number);
  const written = writtenIds.flatMap((id) => entries.filter((e) => e.id === id));
  const first = written[0];

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

      {first && (
        <p className="notice" role="status">
          {isCashKind(first.kind) ? (
            <>
              Mouvement inscrit : {first.label},{" "}
              {septims(signedAmount(first.kind, first.amount), { signed: true })}.
            </>
          ) : (
            <>
              {first.kind === "vente" ? "Vente inscrite" : "Achat inscrit"} :{" "}
              {written.map((e) => `${e.quantity} × ${e.label}`).join(", ")},{" "}
              {septims(written.reduce((sum, e) => sum + e.amount, 0))}
              {written.length > 1 ? " au total" : ""}
              {first.tillPending ? ", en attente de la caisse" : ""}.
            </>
          )}
        </p>
      )}
      <section className="panel" aria-labelledby="registre">
        <div className="eyebrow">Toutes les écritures</div>
        <h2 id="registre">Registre des achats, ventes et mouvements de caisse</h2>
        <MemberDateFilters path={PATH} label="Filtrer le registre" filters={filters} members={authors} employe={employe} du={du} au={au}>
          <label className="small muted" htmlFor="r-type">
            Opération
          </label>
          <select id="r-type" name="type" defaultValue={operation ?? ""}>
            <option value="">Toutes</option>
            <option value="vente">Ventes</option>
            <option value="rachat">Achats</option>
            <option value="caisse">Mouvements de caisse</option>
            <option value="attente">En attente de la caisse</option>
          </select>
        </MemberDateFilters>
        <div className="stats">
          <TillStat title={filtered ? "Caisse sur la sélection" : "Caisse depuis l'ouverture"} till={totals} testId="totaux-registre" />
          {anyWaiting && (
            <div className="stat" data-testid="en-attente">
              <div className="stat-label">En attente de la caisse</div>
              <div className="stat-value muted">{septims(waiting.balance, { signed: true })}</div>
              <div className="small muted">
                {septims(waiting.sales)} à déposer · {septims(waiting.buybacks)} à prendre, pas encore dans la caisse
              </div>
            </div>
          )}
        </div>
        <p className="small muted">
          Les lignes annulées sont barrées et ne comptent pas dans la caisse, pas plus que celles en attente de la caisse.
        </p>
        <RegisterTable entries={entries} member={member} highlight={written.map((e) => e.id)} />
        <Pagination page={page} total={total} path={PATH} params={filters} label="Pages du registre" />
      </section>
    </>
  );
}
