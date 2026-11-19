import { DepositButton } from "@/components/deposit-button";
import { PageHead } from "@/components/page-head";
import { Pagination } from "@/components/pagination";
import { RegisterTable } from "@/components/register-table";
import { requireMember } from "@/lib/auth/session";
import { PAGE_SIZE, offsetOf, pageParam, param } from "@/lib/pagination";
import { shopPath } from "@/lib/paths";
import { formatNumber, septims } from "@/lib/pricing";
import {
  pendingTotals,
  registerCount,
  registerEntries,
  stockReminders,
  toSettle,
  type RegisterFilter,
} from "@/lib/register";

type Search = Record<"page", string | string[] | undefined>;

const dateTime = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Paris" });

/**
 * What the member signed in still has to settle: their entries whose septims
 * are not in the till yet, and their purchases to put in the chest.
 */
export default async function ARegler({ searchParams }: { searchParams: Promise<Search> }) {
  const member = await requireMember();
  const path = shopPath(member.shop.slug, "/a-regler");
  const page = pageParam(param((await searchParams).page));
  // Their lines waiting for the till, cancelled ones left out: nothing to settle there.
  const filter: RegisterFilter = { memberId: member.id, tillPending: true, live: true };
  const [entries, total, waiting, toDeposit] = await Promise.all([
    registerEntries(member.shopId, filter, { limit: PAGE_SIZE, offset: offsetOf(page) }),
    registerCount(member.shopId, filter),
    pendingTotals(member.shopId, filter),
    stockReminders(member.shopId, member.id),
  ]);
  const { deposit, take } = toSettle(waiting);

  return (
    <>
      <PageHead title="À régler">Ce qu&apos;il te reste à faire avec la caisse et le stock.</PageHead>
      <section className="panel" aria-labelledby="septims">
        <div className="eyebrow">Pas encore en caisse</div>
        <h2 id="septims">Mes septims</h2>
        {entries.length === 0 ? (
          <p className="muted">Rien à régler : tous tes septims sont en caisse.</p>
        ) : (
          <>
            <p className="muted">
              Une fois les septims déposés ou pris dans le jeu, dis-le avec le bouton de l&apos;écriture : ils comptent
              alors dans la caisse.
            </p>
            <div className="stats">
              {deposit > 0 && (
                <div className="stat stat-accent-green" data-testid="a-mettre-en-caisse">
                  <div className="stat-label">À mettre en caisse</div>
                  <div className="stat-value plus">{septims(deposit)}</div>
                </div>
              )}
              {take > 0 && (
                <div className="stat stat-accent-red" data-testid="a-sortir-de-la-caisse">
                  <div className="stat-label">À sortir de la caisse</div>
                  <div className="stat-value minus">{septims(take)}</div>
                </div>
              )}
            </div>
            <RegisterTable entries={entries} member={member} />
            <Pagination page={page} total={total} path={path} label="Pages des écritures à régler" />
          </>
        )}
      </section>
      <section className="panel" aria-labelledby="stock">
        <div className="eyebrow">Rappels d&apos;achat</div>
        <h2 id="stock">Mon stock à déposer</h2>
        {toDeposit.length === 0 ? (
          <p className="muted">Rien à déposer dans le stock.</p>
        ) : (
          <ul className="deposit-list">
            {toDeposit.map((r) => {
              const what = r.items.map((i) => `${formatNumber(i.quantity)} × ${i.label}`).join(", ");
              return (
                <li key={r.id} className="deposit-item" data-testid={`a-deposer-${r.id}`}>
                  <span>
                    <strong>{what}</strong>
                    <span className="small muted">
                      Acheté le {dateTime.format(r.createdAt)}
                      {r.counterparty ? ` à ${r.counterparty}` : ""}
                    </span>
                  </span>
                  <DepositButton id={r.id} what={what} />
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
