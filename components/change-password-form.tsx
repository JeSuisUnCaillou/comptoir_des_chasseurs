"use client";

import { useActionState } from "react";
import { changePassword } from "@/app/[boutique]/mot-de-passe/actions";
import { keepValues } from "@/components/keep-values";

/** Changes the password; an account opened with Discord alone, which has none, chooses its first. */
export function ChangePasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const [state, action, pending] = useActionState(changePassword, null);
  return (
    <form onSubmit={keepValues(action)} key={state?.ok ? "done" : "form"}>
      {hasPassword ? (
        <div className="field">
          <label htmlFor="pw-current">Mot de passe actuel</label>
          <input id="pw-current" name="current" type="password" required autoComplete="current-password" />
        </div>
      ) : (
        <p className="muted">
          Ton compte s&apos;ouvre avec Discord. Choisis un mot de passe pour pouvoir aussi entrer avec
          ton identifiant.
        </p>
      )}
      <div className="field">
        <label htmlFor="pw-new">Nouveau mot de passe</label>
        <input id="pw-new" name="password" type="password" required minLength={8} autoComplete="new-password" />
      </div>
      <div className="field">
        <label htmlFor="pw-confirm">Confirmer le nouveau mot de passe</label>
        <input id="pw-confirm" name="confirm" type="password" required minLength={8} autoComplete="new-password" />
      </div>
      {state && (
        <p className={`notice ${state.ok ? "" : "error"}`} role={state.ok ? "status" : "alert"}>
          {state.message}
        </p>
      )}
      <button className="btn btn-primary" type="submit" disabled={pending}>
        {hasPassword ? "Changer mon mot de passe" : "Choisir mon mot de passe"}
      </button>
    </form>
  );
}
