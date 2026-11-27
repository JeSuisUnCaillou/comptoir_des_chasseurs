import Link from "next/link";
import { notFound } from "next/navigation";
import { ContractForm, ContractLineForm, ContractStepButton, DeleteContractButton } from "@/components/contract-forms";
import { ProgressBar } from "@/components/contract-card";
import { PageHead } from "@/components/page-head";
import { requireMember } from "@/lib/auth/session";
import { contractProgress, lineProgress } from "@/lib/contract-progress";
import { contractOf } from "@/lib/contracts";
import { shopPath } from "@/lib/paths";
import { formatNumber, plural, septims } from "@/lib/pricing";
import { activeProducts } from "@/lib/products";
import { removeContractLine } from "../actions";

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
        ) : contract.delivered ? (
          <ul className="contract-lines" aria-label="Marchandises demandées">
            {contract.lines.map((line) => (
              <li key={line.id}>
                <div className="contract-line-head">
                  <span>{line.productName}</span>
                  <span className="contract-line-count">
                    {formatNumber(line.quantity)} {plural(line.unit, line.quantity)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
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
                    <ProgressBar percent={p.percent} label={line.productName} done={p.done} />
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
        {contract.delivered ? (
          <p className="small muted">Le contrat est livré : ses marchandises et son prix ne changent plus.</p>
        ) : (
          <>
            <h3>Demander une marchandise</h3>
            <p className="small muted">Choisir une marchandise déjà demandée remplace sa quantité.</p>
            <ContractLineForm contractId={contract.id} products={products} />
          </>
        )}
      </section>

      <section className="panel" style={{ maxWidth: 760 }}>
        <div className="eyebrow">Livraison et paiement</div>
        {!contract.delivered ? (
          <>
            <h2>Livrer</h2>
            <p className="muted">
              Livrer inscrit au registre une vente de ces marchandises
              {contract.client ? ` à ${contract.client}` : ""}
              {contract.price ? `, pour ${septims(contract.price)}` : ""} : elles sortent du stock.
              {contract.price
                ? " Ses septims restent « pas encore en caisse » jusqu'à ce que l'argent soit reçu."
                : " Sans prix, la vente est à 0 septim."}
            </p>
            <ContractStepButton
              id={contract.id}
              step="livrer"
              label="Livrer les marchandises"
              primary
              confirm={`Livrer ${contract.name} ? Ses marchandises sortent du stock.`}
            />
          </>
        ) : (
          <>
            <h2>{contract.paid ? "Livré et payé" : "Livré, argent attendu"}</h2>
            <p className="muted">
              {contract.paid
                ? "Les marchandises sont livrées et l'argent est en caisse."
                : `Les marchandises sont livrées. ${
                    contract.price ? `Quand les ${septims(contract.price)} arrivent` : "Quand l'argent arrive"
                  }, « Argent reçu » les met en caisse.`}
            </p>
            <div className="contract-steps">
              {!contract.paid && (
                <ContractStepButton id={contract.id} step="payer" label="Argent reçu" primary />
              )}
              <ContractStepButton
                id={contract.id}
                step="annuler"
                label="Annuler la livraison"
                confirm={`Annuler la livraison de ${contract.name} ? Sa vente est annulée et ses marchandises reviennent dans le stock.`}
              />
            </div>
          </>
        )}
      </section>

      <section className="panel" style={{ maxWidth: 760 }}>
        <div className="eyebrow">Attention</div>
        <h2>Supprimer</h2>
        <p className="muted">
          Le contrat et ce qu&apos;il demande disparaissent. Le stock ne bouge pas, et une vente déjà inscrite par
          sa livraison reste au registre.
        </p>
        <DeleteContractButton id={contract.id} name={contract.name} />
      </section>
    </>
  );
}
