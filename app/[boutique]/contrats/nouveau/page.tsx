import Link from "next/link";
import { ContractForm } from "@/components/contract-forms";
import { PageHead } from "@/components/page-head";
import { requireMember } from "@/lib/auth/session";
import { shopPath } from "@/lib/paths";
import { activeProducts } from "@/lib/products";

export default async function NewContract() {
  const member = await requireMember(["gerant"]);
  const products = await activeProducts(member.shopId);
  return (
    <>
      <PageHead title="Nouveau contrat">
        <Link href={shopPath(member.shop.slug, "/contrats")}>← Contrats</Link>
      </PageHead>
      <section className="panel" style={{ maxWidth: 760 }}>
        <ContractForm products={products} />
      </section>
    </>
  );
}
