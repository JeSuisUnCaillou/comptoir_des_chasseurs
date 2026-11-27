import Link from "next/link";
import { ContractForm } from "@/components/contract-forms";
import { PageHead } from "@/components/page-head";
import { requireMember } from "@/lib/auth/session";
import { shopPath } from "@/lib/paths";

export default async function NewContract() {
  const member = await requireMember(["gerant"]);
  return (
    <>
      <PageHead title="Nouveau contrat">
        <Link href={shopPath(member.shop.slug, "/contrats")}>← Contrats</Link>
      </PageHead>
      <section className="panel" style={{ maxWidth: 760 }}>
        <ContractForm />
      </section>
    </>
  );
}
