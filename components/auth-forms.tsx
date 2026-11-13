"use client";

import { useActionState } from "react";
import { createFirstGerant, login, type AuthState } from "@/app/connexion/actions";
import { RETURN_PARAM } from "@/lib/auth/return-path";
import { keepValues } from "@/components/keep-values";

function Field({
  name,
  label,
  type = "text",
  autoComplete,
}: {
  name: string;
  label: string;
  type?: string;
  autoComplete?: string;
}) {
  return (
    <div className="field" style={{ textAlign: "left" }}>
      <label htmlFor={`auth-${name}`}>{label}</label>
      <input id={`auth-${name}`} name={name} type={type} required autoComplete={autoComplete} />
    </div>
  );
}

function ErrorNotice({ state }: { state: AuthState }) {
  if (!state) return null;
  return (
    <p className="notice error" role="alert" style={{ textAlign: "left" }}>
      {state.error}
    </p>
  );
}

export function LoginForm({ returnPath }: { returnPath: string }) {
  const [state, action, pending] = useActionState(login, null);
  return (
    <form onSubmit={keepValues(action)}>
      <input type="hidden" name={RETURN_PARAM} value={returnPath} />
      <Field name="username" label="Identifiant" autoComplete="username" />
      <Field name="password" label="Mot de passe" type="password" autoComplete="current-password" />
      <ErrorNotice state={state} />
      <button className="btn btn-primary" type="submit" disabled={pending}>
        Se connecter
      </button>
    </form>
  );
}

export function FirstGerantForm() {
  const [state, action, pending] = useActionState(createFirstGerant, null);
  return (
    <form onSubmit={keepValues(action)}>
      <p className="notice" style={{ textAlign: "left" }}>
        Premier passage : crée le compte du gérant. Tu pourras ensuite créer ceux des employés.
      </p>
      <Field name="username" label="Identifiant" autoComplete="username" />
      <Field name="name" label="Nom affiché dans les registres" />
      <Field name="password" label="Mot de passe" type="password" autoComplete="new-password" />
      <Field name="confirm" label="Confirmer le mot de passe" type="password" autoComplete="new-password" />
      <ErrorNotice state={state} />
      <button className="btn btn-primary" type="submit" disabled={pending}>
        Créer le compte gérant
      </button>
    </form>
  );
}
