"use client";

import { CalendarCheck } from "lucide-react";
import { useActionState } from "react";
import { declareWeekEnd, type WeekEndState } from "@/app/[boutique]/actions";

/** A gérant's button closing the week, below the till on the Grand livre. */
export function WeekEndButton() {
  const [state, action, pending] = useActionState<WeekEndState>(declareWeekEnd, null);
  return (
    <form action={action} className="inline-form">
      <button
        className="btn btn-small"
        type="submit"
        disabled={pending}
        onClick={(e) => {
          const question =
            "Déclarer la fin de semaine ? Les chiffres du Grand livre repartiront de zéro ; les totaux et le registre ne changent pas.";
          if (!window.confirm(question)) e.preventDefault();
        }}
      >
        <CalendarCheck size={14} /> Déclarer la fin de semaine
      </button>
      {state && (
        <span className={`small ${state.ok ? "plus" : "minus"}`} role={state.ok ? "status" : "alert"}>
          {state.message}
        </span>
      )}
    </form>
  );
}
