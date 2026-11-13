import { Plus, Truck } from "lucide-react";
import Link from "next/link";
import { PageHead } from "@/components/page-head";
import { Pagination } from "@/components/pagination";
import { SupplierCard } from "@/components/supplier-card";
import { requireMember } from "@/lib/auth/session";
import { shopPath } from "@/lib/paths";
import { pageParam, searchParam } from "@/lib/pagination";
import { SUPPLIER_PAGE_SIZE, supplierPage } from "@/lib/suppliers";
import { isGerant } from "@/lib/policies";

type Search = { q?: string | string[]; page?: string | string[] };

export default async function Fournisseurs({ searchParams }: { searchParams: Promise<Search> }) {
  const member = await requireMember();
  const at = (path: string) => shopPath(member.shop.slug, path);
  const gerant = isGerant(member);
  const search = await searchParams;
  const q = searchParam(search.q);
  const page = pageParam(search.page);
  const { suppliers, total } = await supplierPage(member.shopId, q, page);

  return (
    <>
      <PageHead title="Fournisseurs">Qui vend quoi, où, et à quel prix.</PageHead>

      <section className="panel">
        <div className="panel-head">
          <div>
            <div className="eyebrow">Réseau commercial du comptoir</div>
            <h2>
              <Truck size={18} style={{ verticalAlign: "-2px" }} /> Fournisseurs
            </h2>
          </div>
          {gerant && (
            <Link className="btn btn-small" href={at("/fournisseurs/nouveau")}>
              <Plus size={14} /> Ajouter un fournisseur
            </Link>
          )}
        </div>
        <form className="inline-form filters" method="get" aria-label="Chercher un fournisseur">
          <input
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Rechercher un nom, un lieu ou une marchandise"
            aria-label="Rechercher un nom, un lieu ou une marchandise"
            style={{ flex: 1 }}
          />
          <button className="btn btn-small" type="submit">
            Chercher
          </button>
          {q && (
            <Link className="btn btn-small btn-ghost" href={at("/fournisseurs")}>
              Tout afficher
            </Link>
          )}
        </form>
        {suppliers.length === 0 && (
          <p className="muted" style={{ margin: 0 }}>
            {q ? "Aucun fournisseur ne correspond." : "Aucun fournisseur pour l'instant."}
          </p>
        )}
      </section>

      <section className="section-gap">
        <div className="supplier-grid">
          {suppliers.map((s) => (
            <SupplierCard key={s.id} supplier={s} editHref={gerant ? at(`/fournisseurs/${s.id}`) : undefined} />
          ))}
        </div>
        <Pagination
          page={page}
          total={total}
          path={at("/fournisseurs")}
          params={{ q: q || undefined }}
          size={SUPPLIER_PAGE_SIZE}
          label="Pages des fournisseurs"
          noun="fournisseur"
        />
      </section>
    </>
  );
}
