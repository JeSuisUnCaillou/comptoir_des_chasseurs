import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { CashMovementForm } from "@/components/cash-movement-form";
import { PageHead } from "@/components/page-head";
import { requireMember } from "@/lib/auth/session";
import { shopPath } from "@/lib/paths";
import { tillTotals } from "@/lib/register";

export const metadata: Metadata = { title: "Mouvement de caisse" };

/** /achat-vente/caisse: septims in or out of the till, with no merchandise. */
export default async function MouvementDeCaisse() {
  const member = await requireMember();
  const at = (path: string) => shopPath(member.shop.slug, path);
  const till = await tillTotals(member.shopId);

  return (
    <>
      <PageHead title="Mouvement de caisse">
        Des septims entrent ou sortent de la caisse sans marchandise : salaires, apport ou retrait du gérant,
        correction…
      </PageHead>
      <p>
        <Link className="btn btn-small btn-ghost" href={at("/achat-vente")}>
          <ArrowLeft size={14} /> Retour au registre
        </Link>
      </p>
      <section className="panel" style={{ maxWidth: 760 }} aria-label="Inscrire un mouvement de caisse">
        <div className="eyebrow">Nouvelle écriture</div>
        <h2>Inscrire un mouvement de caisse</h2>
        <CashMovementForm balance={till.balance} />
      </section>
    </>
  );
}
