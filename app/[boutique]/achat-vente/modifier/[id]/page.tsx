import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CancelButton } from "@/components/cancel-button";
import { EditEntryForm } from "@/components/edit-entry-form";
import { OperationBadge } from "@/components/operation-badge";
import { PageHead } from "@/components/page-head";
import { requireMember } from "@/lib/auth/session";
import { param } from "@/lib/pagination";
import { returnPath, shopPath } from "@/lib/paths";
import { canActOn } from "@/lib/policies";
import { entryLines } from "@/lib/register";
import { formatNumber } from "@/lib/pricing";
import { counterpartyLabel } from "@/lib/transaction-kinds";

const dateTime = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Paris" });

/** /achat-vente/modifier/<id>: the septims of the entry holding line <id>, for its author or a gérant. */
export default async function ModifierEcriture({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const member = await requireMember();
  // Where the member came from: their activity page, or the register.
  const back = returnPath(param((await searchParams).retour));
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const lines = await entryLines(member.shopId, id);
  const first = lines[0];
  if (!first || !canActOn(member, first)) notFound();

  return (
    <>
      <PageHead title="Modifier une écriture">
        Seuls les septims changent : le stock ne bouge pas. La caisse et les totaux suivent d&apos;eux-mêmes.
      </PageHead>
      <p>
        <Link className="btn btn-small btn-ghost" href={shopPath(member.shop.slug, back ?? "/achat-vente")}>
          <ArrowLeft size={14} /> {back ? "Retour" : "Retour au registre"}
        </Link>
      </p>
      <section className="panel" style={{ maxWidth: 760 }} aria-label="Modifier les montants">
        <div className="eyebrow">
          <OperationBadge kind={first.kind} /> {dateTime.format(first.createdAt)} · {first.member}
        </div>
        <h2>Modifier les montants</h2>
        {first.counterparty && (
          <p className="small muted">
            {counterpartyLabel(first.kind)} : {first.counterparty}
          </p>
        )}
        <EditEntryForm
          id={id}
          back={back}
          kind={first.kind}
          lines={lines.map((l) => ({ id: l.id, label: l.label, quantity: l.quantity, amount: l.amount }))}
        />
      </section>
      {lines.length > 1 && (
        <section className="panel" style={{ maxWidth: 760 }} aria-labelledby="annuler-une-ligne">
          <h2 id="annuler-une-ligne">Annuler une seule ligne</h2>
          <p className="small muted">
            Elle reste barrée dans le registre et ne compte plus ; {first.kind === "vente" ? "ce qui est sorti du stock y revient" : "ce qui est entré en stock en ressort"}.
          </p>
          <ul className="cancel-lines">
            {lines.map((l) => (
              <li key={l.id}>
                <span>
                  {formatNumber(l.quantity)} × {l.label}
                </span>
                <CancelButton
                  id={l.id}
                  text="Annuler"
                  name={`Annuler ${l.label}`}
                  question={`Annuler ${formatNumber(l.quantity)} × ${l.label} ?`}
                />
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
