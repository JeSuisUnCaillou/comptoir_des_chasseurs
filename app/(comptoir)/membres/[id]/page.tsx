import { eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MemberDateFilters } from "@/components/member-date-filters";
import { MovementTable } from "@/components/movement-table";
import { PageHead } from "@/components/page-head";
import { Pagination } from "@/components/pagination";
import { RegisterTable } from "@/components/register-table";
import { TillStat } from "@/components/till-stat";
import { memberContribution } from "@/lib/activity";
import { requireMember } from "@/lib/auth/session";
import { getDb, schema } from "@/lib/db";
import { PAGE_SIZE, offsetOf, pageParam, param } from "@/lib/pagination";
import { septims } from "@/lib/pricing";
import { movementCount, recentMovements } from "@/lib/products";
import { lastDays, parisDay, registerCount, registerEntries, tillTotals } from "@/lib/register";

type Search = Record<"du" | "au" | "page" | "mvt", string | string[] | undefined>;

const longDate = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "Europe/Paris" });

export default async function ActiviteMembre({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Search>;
}) {
  const me = await requireMember(["gerant"]);
  const id = Number((await params).id);
  // Ids are Postgres integers: anything else is no member.
  if (!Number.isInteger(id) || id < 1 || id > 2_147_483_647) notFound();
  const [member] = await getDb().select().from(schema.members).where(eq(schema.members.id, id)).limit(1);
  if (!member) notFound();

  const search = await searchParams;
  // The last 7 days, today included, unless another period is asked for.
  const { du, au, from, to, asked } = lastDays(param(search.du), param(search.au), 7);
  const page = pageParam(search.page);
  const mvt = pageParam(search.mvt);
  const path = `/membres/${member.id}`;
  const filters = { du: asked.du, au: asked.au };
  const filter = { memberId: member.id, from, to };

  const [value, totals, entries, entryTotal, movements, movementTotal] = await Promise.all([
    memberContribution(member.id, from!, to!),
    tillTotals(filter),
    registerEntries(filter, { limit: PAGE_SIZE, offset: offsetOf(page) }),
    registerCount(filter),
    recentMovements(filter, { limit: PAGE_SIZE, offset: offsetOf(mvt) }),
    movementCount(filter),
  ]);
  const period = `Du ${longDate.format(from!)} au ${longDate.format(parisDay(au)!)}`;

  return (
    <>
      <PageHead eyebrow="Activité d'un membre" title={member.name}>
        <Link href="/membres" className="small">
          <ArrowLeft size={14} style={{ verticalAlign: "-2px" }} /> Retour aux membres
        </Link>
      </PageHead>

      <section className="panel" aria-labelledby="valeur">
        <div className="eyebrow">{period}</div>
        <h2 id="valeur">Valeur apportée au comptoir</h2>
        <MemberDateFilters
          path={path}
          label="Choisir la période"
          filters={filters}
          du={du}
          au={au}
          resetLabel="7 derniers jours"
        />
        <div className="stats">
          <div className="stat stat-total" data-testid="valeur-apportee">
            <div className="stat-label">Valeur estimée apportée</div>
            <div className={`stat-value ${value.total >= 0 ? "plus" : "minus"}`}>
              {septims(value.total, { signed: true })}
            </div>
            <div className="small muted">Au prix de vente d&apos;aujourd&apos;hui</div>
          </div>
          <Part testId="valeur-inventaire" title="Inventaire" amount={value.stock}>
            Marchandises entrées moins sorties à la main, au prix de vente.
          </Part>
          <Part testId="valeur-achats" title="Achats" amount={value.buybacks}>
            Ce que la marchandise achetée se revendra, moins ce qu&apos;elle a coûté.
          </Part>
          <Part testId="valeur-ventes" title="Ventes" amount={value.sales}>
            Ce qui a été encaissé, moins la marchandise vendue au tarif.
          </Part>
          <Part testId="valeur-caisse" title="Mouvements de caisse" amount={value.cash}>
            Septims entrés moins sortis sans marchandise.
          </Part>
        </div>
        {value.unpriced > 0 && (
          <p className="small muted">
            {value.unpriced} ligne(s) laissée(s) de côté : leur marchandise n&apos;a pas de prix de vente.
          </p>
        )}
      </section>

      <section className="panel" aria-labelledby="ecritures">
        <div className="panel-head">
          <h2 id="ecritures">Achats, ventes et mouvements de caisse</h2>
        </div>
        <div className="stats">
          <TillStat title="Caisse sur la période" till={totals} testId="totaux-registre" />
        </div>
        <p className="small muted">Les lignes annulées sont barrées et ne comptent pas.</p>
        <RegisterTable entries={entries} member={me} empty="Aucune écriture sur la période." />
        <Pagination
          page={page}
          total={entryTotal}
          path={path}
          params={{ ...filters, mvt: mvt > 1 ? String(mvt) : undefined }}
          label="Pages des écritures"
        />
      </section>

      <section className="panel" aria-labelledby="mouvements">
        <div className="panel-head">
          <h2 id="mouvements">Mouvements de stock</h2>
          <span className="small muted">{movementTotal} mouvement(s)</span>
        </div>
        <p className="muted">Entrées et sorties à la main, et celles de ses achats et ventes.</p>
        <MovementTable movements={movements} empty="Aucun mouvement sur la période." />
        <Pagination
          page={mvt}
          total={movementTotal}
          path={path}
          name="mvt"
          params={{ ...filters, page: page > 1 ? String(page) : undefined }}
          label="Pages des mouvements"
          noun="mouvement"
        />
      </section>
    </>
  );
}

function Part({ title, amount, testId, children }: { title: string; amount: number; testId: string; children: string }) {
  return (
    <div className="stat" data-testid={testId}>
      <div className="stat-label">{title}</div>
      <div className={`stat-value ${amount >= 0 ? "plus" : "minus"}`}>{septims(amount, { signed: true })}</div>
      <div className="small muted">{children}</div>
    </div>
  );
}
