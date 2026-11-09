import { PageHead } from "@/components/page-head";
import { RegisterTable } from "@/components/register-table";
import { TransactionForm } from "@/components/transaction-form";
import { requireMember } from "@/lib/auth/session";
import type { TransactionKind } from "@/lib/db/schema";
import { activeProducts } from "@/lib/products";
import { registerEntries } from "@/lib/register";

export async function TransactionPage({ kind }: { kind: TransactionKind }) {
  const member = await requireMember();
  const sale = kind === "vente";
  const [products, recent] = await Promise.all([activeProducts(), registerEntries({ kind }, 10)]);

  return (
    <>
      <PageHead title={sale ? "Nouvelle vente" : "Nouveau rachat"} />
      <section className="panel" style={{ maxWidth: 760 }} aria-label={sale ? "Inscrire une vente" : "Inscrire un rachat"}>
        <div className="eyebrow">Nouvelle écriture</div>
        <h2>{sale ? "Inscrire une vente" : "Inscrire un rachat"}</h2>
        <p className="muted">
          {sale
            ? "L'argent reçu entre dans la caisse, la marchandise sort du stock."
            : "L'argent versé au vendeur sort de la caisse, la marchandise entre en stock."}
        </p>
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
      <section className="panel">
        <h2>{sale ? "Dernières ventes" : "Derniers rachats"}</h2>
        <RegisterTable entries={recent} member={member} showNotes={false} />
      </section>
    </>
  );
}
