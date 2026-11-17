"use client";

import { Check, ScanLine, Wallet } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";
import { setOpeningTill, skipShopSetup, type ShopSetupState } from "@/app/[boutique]/actions";
import { useShopPath } from "@/components/use-shop-path";

/**
 * The Grand livre of a new shop, for its gérants: what its till holds, then
 * its stock imported from screenshots of a chest. Either step can be done
 * first, and the whole can be skipped.
 */
export function ShopSetup({ tillDone }: { tillDone: boolean }) {
  const at = useShopPath();
  const [state, action, pending] = useActionState<ShopSetupState, FormData>(setOpeningTill, null);

  return (
    <section className="panel setup" aria-labelledby="setup-title">
      <div className="eyebrow">Nouvelle boutique</div>
      <h2 id="setup-title">Initialiser la boutique</h2>
      <p className="muted">
        La boutique n&apos;a encore rien en stock. Deux étapes pour la mettre en route : ce que contient sa caisse, puis
        ce que contient son coffre.
      </p>
      <ol className="setup-steps">
        <li aria-label="Étape 1 : la caisse">
          <h3>
            {tillDone ? <Check size={16} className="plus" aria-hidden /> : <Wallet size={16} aria-hidden />} 1. La caisse
          </h3>
          {tillDone ? (
            <p className="small" role="status">
              Fait : la caisse de départ est inscrite au registre.
            </p>
          ) : (
            <form action={action} className="setup-till">
              <div className="field">
                <label htmlFor="setup-amount">Septims dans la caisse</label>
                <input id="setup-amount" name="amount" type="number" min={1} step={1} required />
              </div>
              <button className="btn btn-primary" type="submit" disabled={pending}>
                <Wallet size={16} /> Mettre en caisse
              </button>
              {state && !state.ok && (
                <p className="notice error" role="alert">
                  {state.message}
                </p>
              )}
              <p className="small muted">
                Inscrit comme un mouvement de caisse en entrée. Caisse vide ? Passe à l&apos;étape 2.
              </p>
            </form>
          )}
        </li>
        <li aria-label="Étape 2 : le stock">
          <h3>
            <ScanLine size={16} aria-hidden /> 2. Le stock
          </h3>
          <p className="small muted">
            Prends des captures du coffre en jeu : l&apos;app lit chaque objet, tu vérifies, et le stock prend ses
            comptes.
          </p>
          <Link className="btn btn-primary" href={at("/inventaire/regularisation")}>
            <ScanLine size={16} /> Importer le stock
          </Link>
        </li>
      </ol>
      <form action={skipShopSetup}>
        <button className="btn btn-small btn-ghost" type="submit">
          Passer l&apos;initialisation
        </button>
      </form>
    </section>
  );
}
