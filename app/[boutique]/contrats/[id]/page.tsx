import Link from "next/link";
import { notFound } from "next/navigation";
import { ContractForm, ContractLineForm, DeleteContractButton } from "@/components/contract-forms";
import { ProgressBar } from "@/components/contract-card";
import { PageHead } from "@/components/page-head";
import { requireMember } from "@/lib/auth/session";
import { contractProgress, lineProgress } from "@/lib/contract-progress";
import { contractOf } from "@/lib/contracts";
import { shopPath } from "@/lib/paths";
import { formatNumber, plural } from "@/lib/pricing";
import { activeProducts } from "@/lib/products";
import { markDelivered, removeContractLine } from "../actions";

export default async function EditContract({ params }: { params: Promise<{ id: string }> }) {
  const member = await requireMember(["gerant"]);
  const at = (path: string) => shopPath(member.shop.slug, path);
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const [contract, products] = await Promise.all([contractOf(member.shopId, id), activeProducts(member.shopId)]);
  if (!contract) notFound();
  const progress = contractProgress(contract.lines);

  return (
    <>
      <PageHead title={contract.name}>
        <Link href={at("/contrats")}>← Contrats</Link>
      </PageHead>

      <section className="panel" style={{ maxWidth: 760 }}>
        <div className="eyebrow">Fiche</div>
        <h2>Le contrat</h2>
        <ContractForm contract={contract} />
      </section>

      <section className="panel" style={{ maxWidth: 760 }}>
        <div className="eyebrow">Ce qu&apos;il demande</div>
        <h2>Marchandises</h2>
        {contract.lines.length === 0 ? (
          <p className="muted">Aucune marchandise demandée pour l&apos;instant.</p>
        ) : (
          <>
            <p className="muted">
              {progress.percent} % · {progress.ready} sur {progress.total} prête{progress.ready > 1 ? "s" : ""}
            </p>
            <ul className="contract-lines" aria-label="Marchandises demandées">
              {contract.lines.map((line) => {
                const p = lineProgress(line);
                return (
                  <li key={line.id}>
                    <div className="contract-line-head">
                      <span>{line.productName}</span>
                      <span className={`contract-line-count${p.done ? " plus" : ""}`}>
                        {formatNumber(line.stock)} / {formatNumber(line.quantity)} {plural(line.unit, line.quantity)}
                      </span>
                    </div>
                    <ProgressBar percent={Math.floor(p.ratio * 100)} label={line.productName} done={p.done} />
                    <form action={removeContractLine}>
                      <input type="hidden" name="id" value={line.id} />
                      <input type="hidden" name="contractId" value={contract.id} />
                      <button className="btn btn-small btn-ghost" type="submit" aria-label={`Retirer ${line.productName}`}>
                        Retirer
                      </button>
                    </form>
                  </li>
                );
              })}
            </ul>
          </>
        )}
        <h3>Demander une marchandise</h3>
        <p className="small muted">Choisir une marchandise déjà demandée remplace sa quantité.</p>
        <ContractLineForm contractId={contract.id} products={products} />
      </section>

      <section className="panel" style={{ maxWidth: 760 }}>
        <div className="eyebrow">Livraison</div>
        <h2>{contract.deliveredAt ? "Contrat livré" : "Livrer"}</h2>
        <p className="muted">
          {contract.deliveredAt
            ? "Il est rangé avec les contrats livrés. Le rouvrir le remet avec les contrats en cours."
            : "Le marquer livré le range avec les contrats livrés. Le stock ne bouge pas : la livraison s'inscrit comme une vente dans Achat / Vente."}
        </p>
        <form action={markDelivered}>
          <input type="hidden" name="id" value={contract.id} />
          <input type="hidden" name="delivered" value={contract.deliveredAt ? "false" : "true"} />
          <button className="btn" type="submit">
            {contract.deliveredAt ? "Rouvrir le contrat" : "Marquer comme livré"}
          </button>
        </form>
      </section>

      <section className="panel" style={{ maxWidth: 760 }}>
        <div className="eyebrow">Attention</div>
        <h2>Supprimer</h2>
        <p className="muted">Le contrat et ce qu&apos;il demande disparaissent. Le stock ne bouge pas.</p>
        <DeleteContractButton id={contract.id} name={contract.name} />
      </section>
    </>
  );
}
