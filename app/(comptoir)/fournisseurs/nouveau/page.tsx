import Link from "next/link";
import { PageHead } from "@/components/page-head";
import { SupplierForm } from "@/components/supplier-forms";
import { requireMember } from "@/lib/auth/session";

export default async function NewSupplier() {
  await requireMember(["gerant"]);
  return (
    <>
      <PageHead title="Nouveau fournisseur">
        <Link href="/fournisseurs">← Fournisseurs</Link>
      </PageHead>
      <section className="panel" style={{ maxWidth: 760 }}>
        <SupplierForm />
      </section>
    </>
  );
}
