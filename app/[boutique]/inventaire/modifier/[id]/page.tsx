import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CancelButton } from "@/components/cancel-button";
import { wholeStockEffect } from "@/components/entry-buttons";
import { EditMovementForm } from "@/components/edit-movement-form";
import { PageHead } from "@/components/page-head";
import { requireMember } from "@/lib/auth/session";
import { safeReturnPath } from "@/lib/auth/return-path";
import { param } from "@/lib/pagination";
import { shopPath } from "@/lib/paths";
import { canActOn } from "@/lib/policies";
import { formatNumber } from "@/lib/pricing";
import { movementEntryLines } from "@/lib/stock";

const dateTime = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Paris" });

/** « +14 Patte de vasard », « −2 Lingot d'or ». */
const signed = (delta: number, product: string) => `${delta > 0 ? "+" : "−"}${formatNumber(Math.abs(delta))} ${product}`;

/**
 * /inventaire/modifier/<id>: the units of the Mouvement de stock holding
 * movement <id>, made by hand, for its author or a gérant.
 */
export default async function ModifierMouvement({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const member = await requireMember();
  // Where the member came from: their activity page, or the Inventaire.
  const retour = param((await searchParams).retour);
  const back = retour ? safeReturnPath(retour) : null;
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const lines = await movementEntryLines(member.shopId, id);
  const first = lines[0];
  if (!first || !canActOn(member, first)) notFound();

  return (
    <>
      <PageHead title="Modifier un mouvement de stock">
        Le stock suit : une entrée plus petite en retire, une sortie plus petite en remet. Jamais sous zéro.
      </PageHead>
      <p>
        <Link className="btn btn-small btn-ghost" href={back ?? shopPath(member.shop.slug, "/inventaire")}>
          <ArrowLeft size={14} /> {back ? "Retour" : "Retour à l'Inventaire"}
        </Link>
      </p>
      <section className="panel" style={{ maxWidth: 760 }} aria-label="Modifier les quantités">
        <div className="eyebrow">
          {dateTime.format(first.createdAt)} · {first.member}
        </div>
        <h2>Modifier les quantités</h2>
        <p className="small muted">Motif : {first.reason}</p>
        {/* Remounted when a movement is cancelled below or its units change, so its fields match the movements. */}
        <EditMovementForm
          key={lines.map((l) => `${l.id}:${l.delta}`).join(",")}
          id={id}
          back={back}
          lines={lines.map((l) => ({ id: l.id, product: l.product, delta: l.delta }))}
        />
      </section>
      {lines.length > 1 && (
        <section className="panel" style={{ maxWidth: 760 }} aria-labelledby="annuler-une-ligne">
          <h2 id="annuler-une-ligne">Annuler une seule ligne</h2>
          <p className="small muted">
            Elle reste barrée dans l&apos;historique et ne compte plus. {wholeStockEffect("stock")}
          </p>
          <ul className="cancel-lines">
            {lines.map((l) => (
              <li key={l.id}>
                <span>{signed(l.delta, l.product)}</span>
                <CancelButton
                  stock
                  id={l.id}
                  text="Annuler"
                  name={`Annuler ${l.product}`}
                  question={`Annuler ${signed(l.delta, l.product)} ?`}
                />
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
