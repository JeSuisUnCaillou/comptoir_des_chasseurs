import { eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHead } from "@/components/page-head";
import { ProductForm } from "@/components/product-form";
import { requireMember } from "@/lib/auth/session";
import { getDb, schema } from "@/lib/db";

export default async function EditProduct({ params }: { params: Promise<{ id: string }> }) {
  await requireMember(["gerant"]);
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const [product] = await getDb()
    .select()
    .from(schema.products)
    .where(eq(schema.products.id, id))
    .limit(1);
  if (!product) notFound();

  return (
    <>
      <PageHead eyebrow="Registres · Gérance" title={product.name}>
        <Link href="/marchandises">← Toutes les marchandises</Link>
      </PageHead>
      <section className="panel" style={{ maxWidth: 760 }}>
        <ProductForm product={product} />
      </section>
    </>
  );
}
