import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { PageHead } from "@/components/page-head";
import { StockMovementForm } from "@/components/stock-movement-form";
import { requireMember } from "@/lib/auth/session";
import { shopPath } from "@/lib/paths";
import { activeProducts } from "@/lib/products";

/** /<slug>/inventaire/mouvement: several merchandises in or out of stock at once, with no septims. */
export default async function MouvementDeStock() {
  const member = await requireMember();
  const products = await activeProducts(member.shopId);

  return (
    <>
      <PageHead title="Mouvement de stock">
        Des marchandises entrent ou sortent du stock sans septims : arrivage, transformation, perte,
        correction…
      </PageHead>
      <p>
        <Link className="btn btn-small btn-ghost" href={shopPath(member.shop.slug, "/inventaire")}>
          <ArrowLeft size={14} /> Retour à l&apos;inventaire
        </Link>
      </p>
      <section className="panel" style={{ maxWidth: 760 }} aria-label="Inscrire un mouvement de stock">
        <div className="eyebrow">Nouveau mouvement</div>
        <h2>Inscrire un mouvement de stock</h2>
        <StockMovementForm
          products={products.map(({ id, name, categoryId, categoryName, unit, stock }) => ({ id, name, categoryId, categoryName, unit, stock }))}
        />
      </section>
    </>
  );
}
