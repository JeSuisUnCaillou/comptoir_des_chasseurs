import { eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHead } from "@/components/page-head";
import { ProductForm } from "@/components/product-form";
import { requireMember } from "@/lib/auth/session";
import { getDb, schema } from "@/lib/db";

export default async function EditProduct({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ depuis?: string | string[] }>;
}) {
  await requireMember(["gerant"]);
  // Opened by a pencil on the Tarifs page: going back and saving lead there.
  const fromTarifs = (await searchParams).depuis === "tarifs";
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
        {fromTarifs ? <Link href="/tarifs">← Tarifs</Link> : <Link href="/marchandises">← Gérer les tarifs</Link>}
      </PageHead>
      <section className="panel" style={{ maxWidth: 760 }}>
        <ProductForm product={product} fromTarifs={fromTarifs} />
      </section>
    </>
  );
}
