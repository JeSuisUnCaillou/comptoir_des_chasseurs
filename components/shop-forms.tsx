"use client";

import { Check, Copy } from "lucide-react";
import { useActionState, useState, useSyncExternalStore } from "react";
import { inviteGerant, openShop, type ShopFormState } from "@/app/boutiques/actions";
import { joinShop, signUp, type InvitationState } from "@/app/invitation/[token]/actions";
import { keepValues } from "@/components/keep-values";

function Field({
  id,
  name,
  label,
  type = "text",
  autoComplete,
  maxLength,
  defaultValue,
}: {
  id: string;
  name: string;
  label: string;
  type?: string;
  autoComplete?: string;
  maxLength?: number;
  defaultValue?: string;
}) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        name={name}
        type={type}
        required
        autoComplete={autoComplete}
        maxLength={maxLength}
        defaultValue={defaultValue}
      />
    </div>
  );
}

function ErrorNotice({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="notice error" role="alert">
      {message}
    </p>
  );
}

const noOrigin = () => () => {};

/** An invitation link in full, ready to copy. The address of the site is only known in the browser. */
export function InvitationLink({ path, label = "Lien d'invitation" }: { path: string; label?: string }) {
  const origin = useSyncExternalStore(noOrigin, () => window.location.origin, () => "");
  const [copied, setCopied] = useState(false);
  const link = origin + path;
  return (
    <div className="invitation-link">
      <input aria-label={label} readOnly value={link} onFocus={(event) => event.currentTarget.select()} />
      <button
        className="btn btn-small"
        type="button"
        onClick={() =>
          navigator.clipboard.writeText(link).then(
            () => setCopied(true),
            () => setCopied(false),
          )
        }
      >
        {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copié" : "Copier"}
      </button>
    </div>
  );
}

/** Opens a shop of one's own. */
export function OpenShopForm() {
  const [state, action, pending] = useActionState<ShopFormState, FormData>(openShop, null);
  return (
    <form onSubmit={keepValues(action)}>
      <Field id="open-shop-name" name="name" label="Nom de la boutique" maxLength={60} autoComplete="off" />
      <ErrorNotice message={state && !state.ok ? state.message : undefined} />
      <button className="btn" type="submit" disabled={pending}>
        Ouvrir la boutique
      </button>
    </form>
  );
}

/** The super admin opens a shop for someone else, and gets its invitation link. */
export function InviteGerantForm() {
  const [state, action, pending] = useActionState<ShopFormState, FormData>(inviteGerant, null);
  return (
    <form onSubmit={keepValues(action)} key={state?.ok ? state.link : "form"}>
      <Field id="invite-shop-name" name="name" label="Nom de sa boutique" maxLength={60} autoComplete="off" />
      <ErrorNotice message={state && !state.ok ? state.message : undefined} />
      {state?.ok && (
        <div className="notice" role="status">
          <p style={{ marginTop: 0 }}>{state.message}</p>
          {state.link && <InvitationLink path={state.link} label="Nouveau lien d'invitation" />}
        </div>
      )}
      <button className="btn" type="submit" disabled={pending}>
        Créer le lien d&apos;invitation
      </button>
    </form>
  );
}

/** The signed-in account takes an invitation. */
export function JoinShopForm({ token, label }: { token: string; label: string }) {
  const [state, action, pending] = useActionState<InvitationState, FormData>(joinShop, null);
  return (
    <form onSubmit={keepValues(action)}>
      <input type="hidden" name="token" value={token} />
      <ErrorNotice message={state?.error} />
      <button className="btn btn-primary" type="submit" disabled={pending}>
        {label}
      </button>
    </form>
  );
}

/** Someone with no account yet takes an invitation. */
export function InvitationSignupForm({ token, name }: { token: string; name: string }) {
  const [state, action, pending] = useActionState<InvitationState, FormData>(signUp, null);
  return (
    <form onSubmit={keepValues(action)} style={{ textAlign: "left" }}>
      <input type="hidden" name="token" value={token} />
      <Field id="inv-username" name="username" label="Identifiant" autoComplete="username" maxLength={40} />
      <Field id="inv-name" name="name" label="Nom affiché dans les registres" maxLength={60} defaultValue={name} />
      <Field id="inv-password" name="password" label="Mot de passe" type="password" autoComplete="new-password" />
      <Field id="inv-confirm" name="confirm" label="Confirmer le mot de passe" type="password" autoComplete="new-password" />
      <ErrorNotice message={state?.error} />
      <button className="btn btn-primary" type="submit" disabled={pending}>
        Créer mon compte et entrer
      </button>
    </form>
  );
}
