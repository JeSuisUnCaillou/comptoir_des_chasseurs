import { eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import { MemberDateFilters } from "@/components/member-date-filters";
import { ActivityTable } from "@/components/activity-table";
import { PageHead } from "@/components/page-head";
import { Pagination } from "@/components/pagination";
import { memberActivity, memberActivityCount, memberHandStock } from "@/lib/activity";
import { requireMember } from "@/lib/auth/session";
import { getDb, schema } from "@/lib/db";
import { PAGE_SIZE, offsetOf, pageParam, param } from "@/lib/pagination";
import { formatNumber, septims } from "@/lib/pricing";
import { lastDays, parisDay, tillTotals } from "@/lib/register";

type Search = Record<"du" | "au" | "page", string | string[] | undefined>;

const longDate = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "Europe/Paris" });

export default async function ActiviteMembre({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Search>;
}) {
  const viewer = await requireMember();
  const gerant = viewer.role === "gerant";
  const id = Number((await params).id);
  // An employee sees only their own page.
  if (!gerant && id !== viewer.id) redirect("/");
  // Ids are Postgres integers: anything else is no member.
  if (!Number.isInteger(id) || id < 1 || id > 2_147_483_647) notFound();
  const [member] = await getDb().select().from(schema.members).where(eq(schema.members.id, id)).limit(1);
  if (!member) notFound();

  const search = await searchParams;
  // The last 7 days, today included, unless another period is asked for.
  const { du, au, from, to, asked } = lastDays(param(search.du), param(search.au), 7);
  const page = pageParam(search.page);
  const path = `/membres/${member.id}`;
  const filters = { du: asked.du, au: asked.au };
  const filter = { memberId: member.id, from, to };

  const [stock, totals, lines, lineTotal] = await Promise.all([
    memberHandStock(member.id, from!, to!),
    tillTotals(filter),
    memberActivity(member.id, from!, to!, { limit: PAGE_SIZE, offset: offsetOf(page) }),
    memberActivityCount(member.id, from!, to!),
  ]);
  const period = `Du ${longDate.format(from!)} au ${longDate.format(parisDay(au)!)}`;

  return (
    <>
      <PageHead eyebrow={member.id === viewer.id ? "Mon activité" : "Activité d'un membre"} title={member.name}>
        {gerant && (
          <Link href="/membres" className="small">
            <ArrowLeft size={14} style={{ verticalAlign: "-2px" }} /> Retour aux membres
          </Link>
        )}
      </PageHead>

      <section className="panel" aria-labelledby="valeur">
        <div className="eyebrow">{period}</div>
        <h2 id="valeur">Ses totaux</h2>
        <MemberDateFilters
          path={path}
          label="Choisir la période"
          filters={filters}
          du={du}
          au={au}
          resetLabel="7 derniers jours"
        />
        <div className="stats">
          <Total testId="total-achats" title="Achats" amount={-totals.buybacks}>
            Septims payés aux vendeurs.
          </Total>
          <Total testId="total-ventes" title="Ventes" amount={totals.sales}>
            Septims encaissés des clients.
          </Total>
          <Total testId="total-inventaire" title="Inventaire" amount={stock.value}>
            +{formatNumber(stock.unitsIn)} / −{formatNumber(stock.unitsOut)} unités à la main, hors achats et ventes,
            au prix de vente.
          </Total>
          <Total testId="total-caisse" title="Mouvements de caisse" amount={totals.inflows - totals.outflows}>
            {septims(totals.inflows)} entrés / {septims(totals.outflows)} sortis, sans marchandise.
          </Total>
        </div>
        {stock.unpriced > 0 && (
          <p className="small muted">
            {stock.unpriced} mouvement(s) de stock laissé(s) de côté : leur marchandise n&apos;a pas de prix de vente.
          </p>
        )}
      </section>

      <section className="panel" aria-labelledby="activite">
        <div className="panel-head">
          <h2 id="activite">Ce qu&apos;il a fait</h2>
          <span className="small muted">{lineTotal} opération(s)</span>
        </div>
        <p className="muted">
          Achats, ventes, mouvements de caisse et mouvements de stock faits à la main, du plus récent au plus ancien.
          Les lignes annulées sont barrées et ne comptent pas, ni celles en attente de la caisse.
        </p>
        <ActivityTable lines={lines} empty="Rien sur la période." />
        <Pagination page={page} total={lineTotal} path={path} params={filters} label="Pages de l'activité" noun="opération" />
      </section>
    </>
  );
}

function Total({ title, amount, testId, children }: { title: string; amount: number; testId: string; children: ReactNode }) {
  return (
    <div className="stat" data-testid={testId}>
      <div className="stat-label">{title}</div>
      <div className={`stat-value ${amount >= 0 ? "plus" : "minus"}`}>{septims(amount, { signed: true })}</div>
      <div className="small muted">{children}</div>
    </div>
  );
}
