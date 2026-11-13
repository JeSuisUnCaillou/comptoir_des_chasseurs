"use client";

import { useActionState } from "react";
import {
  createMember,
  resetPassword,
  type MemberFormState,
} from "@/app/[boutique]/membres/actions";
import { keepValues } from "@/components/keep-values";

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
