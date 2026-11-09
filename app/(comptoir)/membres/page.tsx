import { asc } from "drizzle-orm";
import { PageHead } from "@/components/page-head";
import { NewMemberForm, ResetPasswordForm } from "@/components/member-forms";
import { requireMember } from "@/lib/auth/session";
import { getDb, schema } from "@/lib/db";
import type { MemberRole } from "@/lib/db/schema";
import { updateMember } from "./actions";

const ROLES: { value: MemberRole; label: string }[] = [
  { value: "gerant", label: "Gérant" },
  { value: "employe", label: "Employé" },
  { value: "desactive", label: "Désactivé" },
];

const BADGE: Record<MemberRole, string> = {
  gerant: "badge badge-gold",
  employe: "badge badge-green",
  desactive: "badge badge-red",
};

export default async function Membres() {
  const me = await requireMember(["gerant"]);
  const members = await getDb()
    .select()
    .from(schema.members)
    .orderBy(asc(schema.members.role), asc(schema.members.name));

  return (
    <>
      <PageHead eyebrow="Registres · Gérance" title="Membres">
        Qui peut entrer au comptoir, et sous quel nom.
      </PageHead>

      <section className="panel" aria-labelledby="nouveau-membre">
        <div className="eyebrow">Nouveau compte</div>
        <h2 id="nouveau-membre">Créer un compte</h2>
        <p className="muted">
          Choisis un identifiant et un mot de passe provisoire, puis transmets-les à la personne.
          Elle pourra changer son mot de passe avec la clé, en haut à droite.
        </p>
        <NewMemberForm />
      </section>

      <section className="panel" aria-labelledby="personnel">
        <div className="eyebrow">Personnel du comptoir</div>
        <h2 id="personnel">Comptes</h2>
        <p className="muted">
          Le nom affiché est celui utilisé dans les registres. Un compte désactivé ne peut plus
          entrer, mais son nom reste dans l&apos;historique.
        </p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Identifiant</th>
                <th>Statut</th>
                <th>Nom et rôle</th>
                <th>Mot de passe</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} data-testid={`member-${m.username}`}>
                  <td>{m.username}</td>
                  <td>
                    <span className={BADGE[m.role]}>{ROLES.find((r) => r.value === m.role)?.label}</span>
                  </td>
                  <td>
                    <form action={updateMember} className="inline-form">
                      <input type="hidden" name="id" value={m.id} />
                      <input name="name" defaultValue={m.name} aria-label="Nom affiché" required maxLength={60} />
                      {m.id === me.id ? (
                        <input type="hidden" name="role" value="gerant" />
                      ) : (
                        <select name="role" defaultValue={m.role} aria-label="Rôle">
                          {ROLES.map((r) => (
                            <option key={r.value} value={r.value}>
                              {r.label}
                            </option>
                          ))}
                        </select>
                      )}
                      <button className="btn btn-small" type="submit">
                        Enregistrer
                      </button>
                    </form>
                  </td>
                  <td>{m.id !== me.id && <ResetPasswordForm id={m.id} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
