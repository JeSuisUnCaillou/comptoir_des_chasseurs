import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHead } from "@/components/page-head";
import { ProductForm } from "@/components/product-form";
import { requireMember } from "@/lib/auth/session";
import { shopPath } from "@/lib/paths";
import { productOf } from "@/lib/products";

export const metadata: Metadata = { title: "Marchandise" };

export default async function EditProduct({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ depuis?: string | string[] }>;
}) {
  const member = await requireMember(["gerant"]);
  const at = (path: string) => shopPath(member.shop.slug, path);
  // Opened by a pencil on the Tarifs page: going back and saving lead there.
  const fromTarifs = (await searchParams).depuis === "tarifs";
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const product = await productOf(member.shopId, id);
  if (!product) notFound();

  return (
    <>
      <PageHead title={product.name}>
        {fromTarifs ? <Link href={at("/tarifs")}>← Tarifs</Link> : <Link href={at("/marchandises")}>← Gérer les marchandises</Link>}
      </PageHead>
      <section className="panel" style={{ maxWidth: 760 }}>
        <ProductForm product={product} fromTarifs={fromTarifs} />
      </section>
    </>
  );
}
