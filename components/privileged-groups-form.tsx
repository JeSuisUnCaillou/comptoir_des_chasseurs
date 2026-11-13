"use client";

import { Plus, Trash2 } from "lucide-react";
import { useActionState, useState } from "react";
import { addPrivilegedGroup, savePrivilegedGroup, type GroupState } from "@/app/[boutique]/marchandises/actions";
import { keepValues } from "@/components/keep-values";
import type { GroupChoice } from "@/components/product-price-fields";
import { GROUP_NAME_MAX } from "@/lib/forms";

function Status({ state }: { state: GroupState }) {
  if (!state) return null;
  return (
    <p className={`small ${state.ok ? "plus" : "minus"}`} role={state.ok ? "status" : "alert"} style={{ margin: "6px 0 0" }}>
      {state.message}
    </p>
  );
}

/** One group: its name to change, or the group to remove with its prices. */
function GroupRow({ group }: { group: GroupChoice }) {
  const [state, action, pending] = useActionState(savePrivilegedGroup, null);
  // Removing a group loses its prices on every merchandise: a second click confirms.
  const [confirming, setConfirming] = useState(false);
  return (
    <li>
      <form onSubmit={keepValues(action)} className="inline-form" aria-label={group.name}>
        <input type="hidden" name="id" value={group.id} />
        <input
          name="name"
          defaultValue={group.name}
          required
          maxLength={GROUP_NAME_MAX}
          autoComplete="off"
          aria-label={`Nom du groupe ${group.name}`}
        />
        <button className="btn btn-small" type="submit" name="intent" value="rename" disabled={pending}>
          Renommer
        </button>
        {confirming ? (
          <>
            <button className="btn btn-small minus" type="submit" name="intent" value="delete" formNoValidate disabled={pending}>
              Supprimer le groupe et ses prix
            </button>
            <button className="btn btn-small btn-ghost" type="button" onClick={() => setConfirming(false)}>
              Garder
            </button>
          </>
        ) : (
          <button
            className="icon-btn"
            type="button"
            title={`Supprimer ${group.name}`}
            aria-label={`Supprimer ${group.name}`}
            onClick={() => setConfirming(true)}
          >
            <Trash2 size={16} />
          </button>
        )}
      </form>
      <Status state={state} />
    </li>
  );
}

/**
 * The shop's privileged groups: sellers it buys back from at their own prices,
 * such as the citizens of Estemarche. A gérant adds, renames or removes them.
 */
export function PrivilegedGroupsForm({ groups, max }: { groups: GroupChoice[]; max: number }) {
  const [state, action, pending] = useActionState(addPrivilegedGroup, null);
  return (
    <>
      {groups.length === 0 ? (
        <p className="muted">Aucun : tous les vendeurs ont le même prix.</p>
      ) : (
        <ul className="privileged-groups">
          {groups.map((g) => (
            // The name in the key resets the field once the group is renamed elsewhere.
            <GroupRow key={`${g.id}-${g.name}`} group={g} />
          ))}
        </ul>
      )}
      {groups.length < max && (
        <form onSubmit={keepValues(action)} className="inline-form privileged-add">
          <input
            name="name"
            required
            maxLength={GROUP_NAME_MAX}
            autoComplete="off"
            placeholder="Membres de la guilde des voleurs…"
            aria-label="Nouveau groupe"
          />
          <button className="btn btn-small" type="submit" disabled={pending}>
            <Plus size={14} /> Ajouter le groupe
          </button>
        </form>
      )}
      <Status state={state} />
    </>
  );
}
