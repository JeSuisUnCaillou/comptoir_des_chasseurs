import { ScrollText } from "lucide-react";
import Link from "next/link";
import { PageHead } from "@/components/page-head";
import { Pagination } from "@/components/pagination";
import { pageParam } from "@/lib/pagination";
import { NewMemberForm, ResetPasswordForm } from "@/components/member-forms";
import { requireMember } from "@/lib/auth/session";
import { shopMemberPage } from "@/lib/members";
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

/** The super admin is a gérant in every shop, whatever their role there says. */
function roleOf(member: { role: MemberRole; superAdmin: boolean }): MemberRole {
  return member.superAdmin ? "gerant" : member.role;
}

export default async function Membres({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const me = await requireMember(["gerant"]);
  const page = pageParam((await searchParams).page);
  const { members, total } = await shopMemberPage(me.shopId, page);

  return (
    <>
      <PageHead title="Membres">
        Les membres du comptoir.
      </PageHead>

      <section className="panel" aria-labelledby="nouveau-membre">
        <div className="eyebrow">Nouveau compte</div>
        <h2 id="nouveau-membre">Créer un compte</h2>
        <p className="muted">
          Choisis un identifiant et un mot de passe provisoire, puis transmets-les à la personne.
          Elle pourra le changer ensuite avec l&apos;icône de clé, en haut à droite.
        </p>
        <NewMemberForm />
      </section>

      <section className="panel" aria-labelledby="personnel">
        <div className="eyebrow">Personnel du comptoir</div>
        <h2 id="personnel">Comptes</h2>
        <p className="muted">
          Le nom affiché est celui utilisé dans les registres. Un compte désactivé ne peut plus
          entrer, mais son nom reste dans l&apos;historique. Seul le super admin peut modifier
          son propre compte.
        </p>
        <div className="table-wrap">
          <table className="stack-cards">
            <thead>
              <tr>
                <th>Identifiant</th>
                <th>Statut</th>
                <th>Nom et rôle</th>
                <th>Mot de passe</th>
                <th>Activité</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} data-testid={`member-${m.username}`}>
                  <td className="stack-title">{m.username}</td>
                  <td className="stack-aside">
                    <span className="badges">
                      <span className={BADGE[roleOf(m)]}>{ROLES.find((r) => r.value === roleOf(m))?.label}</span>
                      {m.superAdmin && <span className="badge badge-gold">Super admin</span>}
                    </span>
                  </td>
                  <td>
                    {m.superAdmin && m.id !== me.id ? (
                      <span>{m.name}</span>
                    ) : (
                      <form action={updateMember} className="inline-form">
                        <input type="hidden" name="id" value={m.id} />
                        <input name="name" defaultValue={m.name} aria-label="Nom affiché" required maxLength={60} />
                        {m.id === me.id ? (
                          <input type="hidden" name="role" value="gerant" />
                        ) : (
                          <select name="role" defaultValue={roleOf(m)} aria-label="Rôle">
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
                    )}
                  </td>
                  <td>{m.id !== me.id && !m.superAdmin && <ResetPasswordForm id={m.id} />}</td>
                  <td>
                    <Link className="btn btn-small btn-ghost" href={`/membres/${m.id}`}>
                      <ScrollText size={14} /> Activité
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} total={total} path="/membres" label="Pages des comptes" />
      </section>
    </>
  );
}
