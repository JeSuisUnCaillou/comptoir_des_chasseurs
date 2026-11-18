import { Contact, Plus } from "lucide-react";
import Link from "next/link";
import { PageHead } from "@/components/page-head";
import { LiveSearch } from "@/components/live-search";
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
      <PageHead title="Contacts">Fournisseurs et clients : qui nous vend ou nous achète quoi, où, et à quel prix.</PageHead>

      <section className="panel">
        <div className="panel-head">
          <div>
            <div className="eyebrow">Réseau commercial de la boutique</div>
            <h2>
              <Contact size={18} style={{ verticalAlign: "-2px" }} /> Contacts
            </h2>
          </div>
          {gerant && (
            <Link className="btn btn-small" href={at("/contacts/nouveau")}>
              <Plus size={14} /> Ajouter un contact
            </Link>
          )}
        </div>
        <LiveSearch label="Chercher un nom, un lieu ou une marchandise" />
        {suppliers.length === 0 && (
          <p className="muted" style={{ margin: 0 }}>
            {q ? "Aucun contact ne correspond." : "Aucun contact pour l'instant."}
          </p>
        )}
      </section>

      <section className="section-gap">
        <div className="supplier-grid">
          {suppliers.map((s) => (
            <SupplierCard key={s.id} supplier={s} editHref={gerant ? at(`/contacts/${s.id}`) : undefined} />
          ))}
        </div>
        <Pagination
          page={page}
          total={total}
          path={at("/contacts")}
          params={{ q: q || undefined }}
          size={SUPPLIER_PAGE_SIZE}
          label="Pages des contacts"
          noun="contact"
        />
      </section>
    </>
  );
}
