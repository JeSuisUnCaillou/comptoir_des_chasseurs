"use client";

import { Megaphone, Save } from "lucide-react";
import { useActionState } from "react";
import { editAnnouncement, postAnnouncement } from "@/app/(comptoir)/annonces/actions";
import { PinIcon } from "@/components/pins";
import { BODY_MAX, PINS, TITLE_MAX } from "@/lib/announcement-rules";
import type { AnnouncementPin } from "@/lib/db/schema";
import { keepValues } from "@/components/keep-values";

type Editing = { id: number; title: string; body: string; pin: AnnouncementPin };

/** Pins a new parchment, or, given `announcement`, rewrites it and goes back to `back`. */
export function AnnouncementForm({ announcement, back }: { announcement?: Editing; back?: string }) {
  const [state, action, pending] = useActionState(announcement ? editAnnouncement : postAnnouncement, null);
  const pin = announcement?.pin ?? PINS[0].value;
  return (
    <form onSubmit={keepValues(action)} key={state?.ok ? `posted-${state.id}` : "form"} className="announcement-form">
      {announcement && (
        <>
          <input type="hidden" name="id" value={announcement.id} />
          <input type="hidden" name="back" value={back ?? "/annonces"} />
        </>
      )}
      <div className="field">
        <label htmlFor="an-title">Titre de l&apos;annonce</label>
        <input id="an-title" name="title" required maxLength={TITLE_MAX} defaultValue={announcement?.title} />
      </div>
      <div className="field">
        <label htmlFor="an-body">Texte à afficher</label>
        <textarea
          id="an-body"
          name="body"
          required
          maxLength={BODY_MAX}
          rows={6}
          className="parchment-input"
          defaultValue={announcement?.body}
        />
      </div>
      <fieldset className="pin-choice">
        <legend>Avec quoi l&apos;accrocher ?</legend>
        <div className="pin-options">
          {PINS.map((p) => (
            <label key={p.value} className="pin-option">
              <input type="radio" name="pin" value={p.value} defaultChecked={p.value === pin} />
              <PinIcon pin={p.value} size={56} />
              <span>{p.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <button className="btn btn-primary" type="submit" disabled={pending}>
        {announcement ? (
          <>
            <Save size={16} /> Enregistrer le parchemin
          </>
        ) : (
          <>
            <Megaphone size={16} /> Accrocher le parchemin
          </>
        )}
      </button>
      {state && (
        <p className={`small ${state.ok ? "plus" : "minus"}`} role={state.ok ? "status" : "alert"} style={{ margin: "8px 0 0" }}>
          {state.message}
        </p>
      )}
    </form>
  );
}
