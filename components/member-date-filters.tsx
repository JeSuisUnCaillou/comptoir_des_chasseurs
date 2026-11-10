import Link from "next/link";
import type { ReactNode } from "react";

/**
 * The GET form of a filtered list: the page's own fields (`children`), then
 * the member and date-range fields, "Filtrer", and "Tout afficher" once
 * something is filtered. `filters` holds every current filter value.
 */
export function MemberDateFilters({
  path,
  label,
  filters,
  members,
  employe,
  du,
  au,
  children,
}: {
  path: string;
  label: string;
  filters: Record<string, string | undefined>;
  members: { id: number; name: string }[];
  employe?: string;
  du?: string;
  au?: string;
  children?: ReactNode;
}) {
  const filtered = Object.values(filters).some(Boolean);
  return (
    // Keyed on the filters so "Tout afficher" resets the fields, which keep their value across client navigation.
    <form key={JSON.stringify(filters)} className="inline-form filters" method="get" action={path} aria-label={label}>
      {children}
      <label className="small muted" htmlFor="f-employe">
        Employé
      </label>
      <select id="f-employe" name="employe" defaultValue={employe ?? ""}>
        <option value="">Tous</option>
        {members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
      <label className="small muted" htmlFor="f-du">
        Du
      </label>
      <input id="f-du" name="du" type="date" defaultValue={du ?? ""} />
      <label className="small muted" htmlFor="f-au">
        Au
      </label>
      <input id="f-au" name="au" type="date" defaultValue={au ?? ""} />
      <button className="btn btn-small" type="submit">
        Filtrer
      </button>
      {filtered && (
        <Link className="btn btn-small btn-ghost" href={path}>
          Tout afficher
        </Link>
      )}
    </form>
  );
}
