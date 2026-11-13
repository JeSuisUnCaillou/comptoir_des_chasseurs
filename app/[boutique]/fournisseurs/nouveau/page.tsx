import Link from "next/link";
import { PageHead } from "@/components/page-head";
import { SupplierForm } from "@/components/supplier-forms";
import { requireMember } from "@/lib/auth/session";
import { shopPath } from "@/lib/paths";

export default async function NewSupplier() {
  const member = await requireMember(["gerant"]);
  const at = (path: string) => shopPath(member.shop.slug, path);
  return (
    <>
      <PageHead title="Nouveau contact">
        <Link href={at("/fournisseurs")}>← Contacts</Link>
      </PageHead>
      <section className="panel" style={{ maxWidth: 760 }}>
        <SupplierForm />
      </section>
    </>
  );
}
