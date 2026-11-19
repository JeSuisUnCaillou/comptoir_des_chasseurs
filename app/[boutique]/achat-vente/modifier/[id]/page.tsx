import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EditEntryForm } from "@/components/edit-entry-form";
import { OperationBadge } from "@/components/operation-badge";
import { PageHead } from "@/components/page-head";
import { requireMember } from "@/lib/auth/session";
import { shopPath } from "@/lib/paths";
import { canActOn } from "@/lib/policies";
import { entryLines } from "@/lib/register";
import { counterpartyLabel } from "@/lib/transaction-kinds";

const dateTime = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Paris" });

/** /achat-vente/modifier/<id>: the septims of the entry holding line <id>, for its author or a gérant. */
export default async function ModifierEcriture({ params }: { params: Promise<{ id: string }> }) {
  const member = await requireMember();
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
        <Link className="btn btn-small btn-ghost" href={shopPath(member.shop.slug, "/achat-vente")}>
          <ArrowLeft size={14} /> Retour au registre
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
          kind={first.kind}
          lines={lines.map((l) => ({ id: l.id, label: l.label, quantity: l.quantity, amount: l.amount }))}
        />
      </section>
    </>
  );
}
