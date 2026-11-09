import { asc } from "drizzle-orm";
import { PageHead } from "@/components/page-head";
import { requireMember } from "@/lib/auth/session";
import { getDb, schema } from "@/lib/db";
import type { MemberRole } from "@/lib/db/schema";
import { updateMember } from "./actions";

const ROLES: { value: MemberRole; label: string }[] = [
  { value: "gerant", label: "Gérant" },
  { value: "employe", label: "Employé" },
  { value: "en_attente", label: "En attente" },
  { value: "refuse", label: "Refusé" },
];

const BADGE: Record<MemberRole, string> = {
  gerant: "badge badge-gold",
  employe: "badge badge-green",
  en_attente: "badge",
  refuse: "badge badge-red",
};

export default async function Membres() {
  const me = await requireMember(["gerant"]);
  const members = await getDb()
    .select()
    .from(schema.members)
    .orderBy(asc(schema.members.role), asc(schema.members.name));
  const waiting = members.filter((m) => m.role === "en_attente").length;

  return (
    <>
      <PageHead eyebrow="Registres · Gérance" title="Membres">
        Qui peut entrer au comptoir, et sous quel nom.
      </PageHead>
      {waiting > 0 && (
        <p className="notice" role="status">
          {waiting} personne{waiting > 1 ? "s attendent" : " attend"} ta validation.
        </p>
      )}
      <section className="panel">
        <div className="eyebrow">Personnel du comptoir</div>
        <h2>Accès</h2>
        <p className="muted">
          Les nouveaux venus se connectent avec Discord, puis attendent qu&apos;un gérant les
          valide. Le nom affiché est celui utilisé dans les registres.
        </p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Discord</th>
                <th>Statut</th>
                <th>Nom et rôle</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} data-testid={`member-${m.discordName}`}>
                  <td>{m.discordName}</td>
                  <td>
                    <span className={BADGE[m.role]}>
                      {ROLES.find((r) => r.value === m.role)?.label}
                    </span>
                  </td>
                  <td>
                    <form action={updateMember} className="inline-form">
                      <input type="hidden" name="id" value={m.id} />
                      <input name="name" defaultValue={m.name} aria-label="Nom affiché" required maxLength={60} />
                      <select name="role" defaultValue={m.role} aria-label="Rôle" disabled={m.id === me.id}>
                        {ROLES.map((r) => (
                          <option key={r.value} value={r.value}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                      {m.id === me.id && <input type="hidden" name="role" value="gerant" />}
                      <button className="btn btn-small" type="submit">
                        Enregistrer
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
