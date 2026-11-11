"use client";

import { Megaphone } from "lucide-react";
import { useActionState } from "react";
import { postAnnouncement } from "@/app/[boutique]/annonces/actions";
import { PinIcon } from "@/components/pins";
import { BODY_MAX, PINS, TITLE_MAX } from "@/lib/announcement-rules";
import { keepValues } from "@/components/keep-values";

export function AnnouncementForm() {
  const [state, action, pending] = useActionState(postAnnouncement, null);
  return (
    <form onSubmit={keepValues(action)} key={state?.ok ? `posted-${state.id}` : "form"} className="announcement-form">
      <div className="field">
        <label htmlFor="an-title">Titre de l&apos;annonce</label>
        <input id="an-title" name="title" required maxLength={TITLE_MAX} />
      </div>
      <div className="field">
        <label htmlFor="an-body">Texte à afficher</label>
        <textarea id="an-body" name="body" required maxLength={BODY_MAX} rows={6} className="parchment-input" />
      </div>
      <fieldset className="pin-choice">
        <legend>Comment fixer le parchemin ?</legend>
        <div className="pin-options">
          {PINS.map((p, i) => (
            <label key={p.value} className="pin-option">
              <input type="radio" name="pin" value={p.value} defaultChecked={i === 0} />
              <PinIcon pin={p.value} size={56} />
              <span>{p.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <button className="btn btn-primary" type="submit" disabled={pending}>
        <Megaphone size={16} /> Accrocher le parchemin
      </button>
      {state && (
        <p className={`small ${state.ok ? "plus" : "minus"}`} role={state.ok ? "status" : "alert"} style={{ margin: "8px 0 0" }}>
          {state.message}
        </p>
      )}
    </form>
  );
}
