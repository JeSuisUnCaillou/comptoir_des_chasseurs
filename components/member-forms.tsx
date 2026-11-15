"use client";

import { useActionState } from "react";
import {
  inviteEmployee,
  createMember,
  resetPassword,
  setMemberActive,
  type MemberFormState,
} from "@/app/[boutique]/membres/actions";
import { keepValues } from "@/components/keep-values";
import { InvitationLink } from "@/components/shop-forms";

function Status({ state }: { state: MemberFormState }) {
  if (!state) return null;
  return (
    <p className={`small ${state.ok ? "plus" : "minus"}`} role={state.ok ? "status" : "alert"} style={{ margin: "6px 0 0" }}>
      {state.message}
    </p>
  );
}

export function NewMemberForm() {
  const [state, action, pending] = useActionState(createMember, null);
  return (
    <form onSubmit={keepValues(action)} key={state?.ok ? state.message : "form"}>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="nm-username">Identifiant</label>
          <input id="nm-username" name="username" required maxLength={40} autoComplete="off" />
        </div>
        <div className="field">
          <label htmlFor="nm-name">Nom affiché (RP)</label>
          <input id="nm-name" name="name" required maxLength={60} />
        </div>
        <div className="field">
          <label htmlFor="nm-password">Mot de passe provisoire</label>
          <input id="nm-password" name="password" required minLength={8} autoComplete="new-password" />
        </div>
        <div className="field">
          <label htmlFor="nm-role">Rôle</label>
          <select id="nm-role" name="role" defaultValue="employe">
            <option value="employe">Employé</option>
            <option value="gerant">Gérant</option>
          </select>
        </div>
      </div>
      <button className="btn" type="submit" disabled={pending}>
        Créer le compte
      </button>
      <Status state={state} />
    </form>
  );
}

export function ResetPasswordForm({ id }: { id: number }) {
  const [state, action, pending] = useActionState(resetPassword, null);
  return (
    <form onSubmit={keepValues(action)}>
      <div className="inline-form">
        <input type="hidden" name="id" value={id} />
        <input
          name="password"
          aria-label="Nouveau mot de passe"
          placeholder="nouveau mot de passe"
          required
          minLength={8}
          autoComplete="new-password"
        />
        <button className="btn btn-small" type="submit" disabled={pending}>
          Changer
        </button>
      </div>
      <Status state={state} />
    </form>
  );
}

/** Deactivates an account of the shop, or reactivates it as an employé. */
export function ActiveToggleForm({ id, active, name }: { id: number; active: boolean; name: string }) {
  const [state, action, pending] = useActionState(setMemberActive, null);
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="active" value={active ? "false" : "true"} />
      <button
        className={active ? "btn btn-small btn-ghost" : "btn btn-small"}
        type="submit"
        disabled={pending}
        aria-label={`${active ? "Désactiver" : "Réactiver"} ${name}`}
      >
        {active ? "Désactiver" : "Réactiver"}
      </button>
      <Status state={state} />
    </form>
  );
}

/** Creates an employé invitation link, and shows it ready to copy. */
export function InviteEmployeeForm() {
  const [state, action, pending] = useActionState(inviteEmployee, null);
  return (
    <form action={action} key={state?.link ?? "form"}>
      <div className="field" style={{ maxWidth: 360 }}>
        <label htmlFor="invite-name">Nom de l&apos;employé (facultatif)</label>
        <input id="invite-name" name="name" maxLength={60} autoComplete="off" placeholder="Son nom RP" />
      </div>
      {state && (
        <div className="notice" role="status">
          <p style={{ marginTop: 0 }}>
            Lien créé{state.name ? ` pour ${state.name}` : ""}. Envoie-le à la personne : il ne sert
            qu&apos;une fois.
          </p>
          <InvitationLink path={state.link} label="Nouveau lien d'invitation" />
        </div>
      )}
      <button className="btn" type="submit" disabled={pending}>
        Créer un lien d&apos;invitation
      </button>
    </form>
  );
}
