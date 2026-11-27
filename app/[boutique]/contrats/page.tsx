import { Plus, ScrollText } from "lucide-react";
import Link from "next/link";
import { ContractCard } from "@/components/contract-card";
import { PageHead } from "@/components/page-head";
import { Pagination } from "@/components/pagination";
import { requireMember } from "@/lib/auth/session";
import { DELIVERED_PAGE_SIZE, deliveredContracts, openContracts } from "@/lib/contracts";
import { parisToday } from "@/lib/dates";
import { pageParam } from "@/lib/pagination";
import { shopPath } from "@/lib/paths";
import { isGerant } from "@/lib/policies";

export default async function Contrats({ searchParams }: { searchParams: Promise<{ page?: string | string[] }> }) {
  const member = await requireMember();
  const at = (path: string) => shopPath(member.shop.slug, path);
  const gerant = isGerant(member);
  const page = pageParam((await searchParams).page);
  const [open, delivered] = await Promise.all([openContracts(member.shopId), deliveredContracts(member.shopId, page)]);
  const today = parisToday();
  const editHref = (id: number) => (gerant ? at(`/contrats/${id}`) : undefined);

  return (
    <>
      <PageHead title="Contrats">Ce qu&apos;on nous demande, et où en est le stock pour le livrer.</PageHead>

      <section className="panel">
        <div className="panel-head">
          <div>
            <div className="eyebrow">Commandes à honorer</div>
            <h2>
              <ScrollText size={18} style={{ verticalAlign: "-2px" }} /> Contrats en cours
            </h2>
          </div>
          {gerant && (
            <Link className="btn btn-small" href={at("/contrats/nouveau")}>
              <Plus size={14} /> Nouveau contrat
            </Link>
          )}
        </div>
        <p className="muted" style={{ margin: 0 }}>
          {open.length === 0
            ? "Aucun contrat en cours."
            : "Chaque marchandise face au stock d'aujourd'hui. Deux contrats qui demandent la même marchandise comptent le même stock."}
        </p>
      </section>

      {open.length > 0 && (
        <section className="section-gap" aria-label="Contrats en cours">
          <div className="contract-grid">
            {open.map((c) => (
              <ContractCard key={c.id} contract={c} editHref={editHref(c.id)} today={today} />
            ))}
          </div>
        </section>
      )}

      {delivered.total > 0 && (
        <section className="section-gap" aria-label="Contrats livrés">
          <div className="panel-head">
            <h2>Contrats livrés</h2>
          </div>
          <div className="contract-grid">
            {delivered.contracts.map((c) => (
              <ContractCard key={c.id} contract={c} editHref={editHref(c.id)} today={today} />
            ))}
          </div>
          <Pagination
            page={page}
            total={delivered.total}
            path={at("/contrats")}
            size={DELIVERED_PAGE_SIZE}
            label="Pages des contrats livrés"
            noun="contrat"
          />
        </section>
      )}
    </>
  );
}
