import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHead } from "@/components/page-head";
import { TransactionForm } from "@/components/transaction-form";
import { requireMember } from "@/lib/auth/session";
import { activeProducts } from "@/lib/products";

/** /achat-vente/vente and /achat-vente/achat: the entry form, on a page of its own. */
export default async function NouvelleEcriture({ params }: { params: Promise<{ kind: string }> }) {
  await requireMember();
  const { kind: segment } = await params;
  if (segment !== "vente" && segment !== "achat") notFound();
  const kind = segment === "vente" ? "vente" : "rachat";
  const sale = kind === "vente";
  const products = await activeProducts();

  return (
    <>
      <PageHead title={sale ? "Nouvelle vente" : "Nouvel achat"}>
        {sale
          ? "Un client paie : l'argent entre dans la caisse, la marchandise sort du stock."
          : "On paie un vendeur : l'argent sort de la caisse, la marchandise entre en stock."}
      </PageHead>
      <p>
        <Link className="btn btn-small btn-ghost" href="/achat-vente">
          <ArrowLeft size={14} /> Retour au registre
        </Link>
      </p>
      <section
        className="panel"
        style={{ maxWidth: 760 }}
        aria-label={sale ? "Inscrire une vente" : "Inscrire un achat"}
      >
        <div className="eyebrow">Nouvelle écriture</div>
        <h2>{sale ? "Inscrire une vente" : "Inscrire un achat"}</h2>
        <TransactionForm
          kind={kind}
          products={products.map((p) => ({
            id: p.id,
            name: p.name,
            category: p.category,
            unit: p.unit,
            stock: p.stock,
            buyPrice: p.buyPrice,
            buyQty: p.buyQty,
            sellPrice: p.sellPrice,
            sellQty: p.sellQty,
            bulkMin: p.bulkMin,
            bulkPrice: p.bulkPrice,
            bulkQty: p.bulkQty,
          }))}
        />
      </section>
    </>
  );
}
