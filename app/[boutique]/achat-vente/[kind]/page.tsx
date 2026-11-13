import { notFound } from "next/navigation";
import { PageHead } from "@/components/page-head";
import { TransactionForm } from "@/components/transaction-form";
import { requireMember } from "@/lib/auth/session";
import { activeProducts } from "@/lib/products";
import { DRAFT_PARAM, decodeDraft } from "@/lib/transaction-draft";

/**
 * /achat-vente/vente and /achat-vente/achat: the entry form, on a page of its own.
 * `?reprise=` carries what was filled in on the other one (lib/transaction-draft).
 */
export default async function NouvelleEcriture({
  params,
  searchParams,
}: {
  params: Promise<{ kind: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const member = await requireMember();
  const { kind: segment } = await params;
  if (segment !== "vente" && segment !== "achat") notFound();
  const kind = segment === "vente" ? "vente" : "rachat";
  const sale = kind === "vente";
  const products = await activeProducts(member.shopId);

  return (
    <>
      <PageHead title={sale ? "Nouvelle vente" : "Nouvel achat"}>
        {sale
          ? "Un client nous achète de la marchandise."
          : "On rachète de la marchandise à quelqu'un."}
      </PageHead>
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
          citizenBuyPrice: p.citizenBuyPrice,
          sellPrice: p.sellPrice,
          sellQty: p.sellQty,
          bulkMin: p.bulkMin,
          bulkPrice: p.bulkPrice,
          bulkQty: p.bulkQty,
        }))}
        draft={decodeDraft((await searchParams)[DRAFT_PARAM])}
      />
    </>
  );
}
