"use client";

import { startTransition, useActionState, useState, useSyncExternalStore, type FormEvent } from "react";
import { removeLogo, removeShop, saveLogo, saveShop, type ShopSettingsState } from "@/app/[boutique]/reglages/actions";
import { keepValues } from "@/components/keep-values";
import { LOGO_MAX_SIDE } from "@/lib/logo";
import { slugify } from "@/lib/paths";

const noOrigin = () => () => {};

function Status({ state }: { state: ShopSettingsState }) {
  if (!state) return null;
  return (
    <p className={`small ${state.ok ? "plus" : "minus"}`} role={state.ok ? "status" : "alert"} style={{ margin: "6px 0 0" }}>
      {state.message}
    </p>
  );
}

/**
 * The shop's name and address, with the link the address gives, shown as it
 * is typed. The comptoir's address can't change.
 */
export function ShopForm({ name, slug, fixedSlug }: { name: string; slug: string; fixedSlug: boolean }) {
  const [state, action, pending] = useActionState(saveShop, null);
  const [address, setAddress] = useState(slug);
  const origin = useSyncExternalStore(noOrigin, () => window.location.origin, () => "");
  const typed = fixedSlug ? slug : slugify(address);
  return (
    <form onSubmit={keepValues(action)}>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="shop-name">Nom de la boutique</label>
          <input id="shop-name" name="name" defaultValue={name} required maxLength={60} autoComplete="off" />
        </div>
        <div className="field">
          <label htmlFor="shop-slug">Adresse</label>
          <input
            id="shop-slug"
            name="slug"
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            required
            maxLength={60}
            autoComplete="off"
            disabled={fixedSlug}
            aria-describedby="shop-slug-hint"
          />
          <span id="shop-slug-hint" className="small muted">
            {fixedSlug
              ? "Cette boutique garde son adresse : ses anciens liens y mènent."
              : "Changer l'adresse casse les liens déjà donnés vers la boutique."}
          </span>
        </div>
      </div>
      <p className="small shop-link-preview">
        Lien de la boutique :{" "}
        {typed ? (
          <a href={`/${typed}`} data-testid="shop-link">
            {origin}/{typed}
          </a>
        ) : (
          <span className="minus">l&apos;adresse doit contenir au moins une lettre ou un chiffre.</span>
        )}
      </p>
      <button className="btn" type="submit" disabled={pending}>
        Enregistrer la boutique
      </button>
      <Status state={state} />
    </form>
  );
}

/** Deletes the shop, once its name is typed again. */
export function DeleteShopForm({ name }: { name: string }) {
  const [state, action, pending] = useActionState(removeShop, null);
  return (
    <form onSubmit={keepValues(action)}>
      <div className="field" style={{ maxWidth: 420 }}>
        <label htmlFor="shop-confirm">Pour confirmer, écris « {name} »</label>
        <input id="shop-confirm" name="confirm" required maxLength={60} autoComplete="off" />
      </div>
      <button className="btn minus" type="submit" disabled={pending}>
        Supprimer la boutique
      </button>
      <Status state={state} />
    </form>
  );
}

/**
 * Shrinks an image file to a PNG of at most LOGO_MAX_SIDE pixels a side,
 * keeping its proportions and transparency. Rejects what the browser can't
 * read as an image.
 */
async function shrinkToPng(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const width = image.naturalWidth || LOGO_MAX_SIDE;
    const height = image.naturalHeight || LOGO_MAX_SIDE;
    const scale = Math.min(1, LOGO_MAX_SIDE / Math.max(width, height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("no canvas");
    context.imageSmoothingQuality = "high";
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("no blob"))), "image/png"),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * The shop's logo: an image chosen here, shrunk by the page, becomes the logo
 * in the menu and the icon of the browser tab. Removing it brings the app's back.
 */
export function LogoForm({ current, custom }: { current: string; custom: boolean }) {
  // One status line for both buttons: the last one pressed.
  const [state, action, pending] = useActionState(
    (prev: ShopSettingsState, formData: FormData) => (formData.has("logo") ? saveLogo(prev, formData) : removeLogo(prev)),
    null,
  );
  const [chosen, setChosen] = useState<{ blob: Blob; preview: string } | null>(null);
  const [unreadable, setUnreadable] = useState(false);

  async function choose(file: File | undefined) {
    setUnreadable(false);
    if (chosen) URL.revokeObjectURL(chosen.preview);
    setChosen(null);
    if (!file) return;
    try {
      const blob = await shrinkToPng(file);
      setChosen({ blob, preview: URL.createObjectURL(blob) });
    } catch {
      setUnreadable(true);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!chosen) return;
    const formData = new FormData();
    formData.set("logo", chosen.blob, "logo.png");
    startTransition(() => action(formData));
  }

  const shown = chosen?.preview ?? current;
  return (
    <div className="logo-settings">
      <img className="logo-preview" src={shown} alt={chosen ? "Aperçu du nouveau logo" : "Logo actuel"} />
      <div className="logo-settings-forms">
        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="shop-logo">Image du logo</label>
            <input
              id="shop-logo"
              type="file"
              accept="image/*"
              onChange={(event) => void choose(event.target.files?.[0])}
              aria-describedby="shop-logo-hint"
            />
            <span id="shop-logo-hint" className="small muted">
              {unreadable
                ? null
                : `Réduite à ${LOGO_MAX_SIDE} pixels au plus. Une image carrée rend le mieux dans l'onglet du navigateur.`}
            </span>
            {unreadable && (
              <span className="small minus" role="alert">
                Ce fichier n&apos;est pas une image que le navigateur sait lire.
              </span>
            )}
          </div>
          <div className="logo-settings-buttons">
            <button className="btn" type="submit" disabled={!chosen || pending}>
              Enregistrer le logo
            </button>
            {custom && (
              <button
                className="btn btn-ghost"
                type="button"
                disabled={pending}
                onClick={() => startTransition(() => action(new FormData()))}
              >
                Retirer le logo
              </button>
            )}
          </div>
        </form>
        <Status state={state} />
      </div>
    </div>
  );
}
