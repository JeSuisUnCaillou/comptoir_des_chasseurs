import { ScrollText } from "lucide-react";
import Link from "next/link";
import { PageHead } from "@/components/page-head";
import { Pagination } from "@/components/pagination";
import { pageParam } from "@/lib/pagination";
import { ActiveToggleForm, InviteEmployeeForm, NewMemberForm, ResetPasswordForm } from "@/components/member-forms";
import { requireMember } from "@/lib/auth/session";
import { invitationPath, shopPath } from "@/lib/paths";
import { shopMemberPage } from "@/lib/members";
import type { MemberRole } from "@/lib/db/schema";
import { InvitationLink } from "@/components/shop-forms";
import { pendingEmployeeInvitations } from "@/lib/invitations";
import { updateMember } from "./actions";

const longDate = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "Europe/Paris" });

const LABELS: Record<MemberRole, string> = {
  gerant: "Gérant",
  employe: "Employé",
  desactive: "Désactivé",
};

/** The selector moves between these; deactivating has its own button. */
const ROLES = ["gerant", "employe"] as const;

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
  const at = (path: string) => shopPath(me.shop.slug, path);
  const page = pageParam((await searchParams).page);
  const { members, total } = await shopMemberPage(me.shopId, page);
  const invitations = await pendingEmployeeInvitations(me.shopId);

  return (
    <>
      <PageHead title="Membres">
        Les membres de la boutique.
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

      <section className="panel" aria-labelledby="inviter">
        <div className="eyebrow">Lien d&apos;invitation</div>
        <h2 id="inviter">Inviter un employé</h2>
        <p className="muted">
          Crée un lien et envoie-le, sur Discord par exemple : la personne qui l&apos;ouvre entre
          dans la boutique comme employé, avec son compte, un compte qu&apos;elle crée, ou Discord
          seul. Le nom que tu donnes devient celui de son nouveau compte. Un lien ne sert
          qu&apos;une fois.
        </p>
        <InviteEmployeeForm />
        {invitations.length > 0 && (
          <ul className="invitation-list" aria-label="Liens pas encore utilisés">
            {invitations.map((invitation) => (
              <li key={invitation.id}>
                <div>
                  {invitation.name && <strong>{invitation.name}</strong>}
                  <div className="small muted">Créé le {longDate.format(invitation.createdAt)}</div>
                </div>
                <InvitationLink path={invitationPath(invitation.token)} label="Lien d'invitation d'employé" />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel" aria-labelledby="personnel">
        <div className="eyebrow">Personnel de la boutique</div>
        <h2 id="personnel">Comptes</h2>
        <p className="muted">
          Le nom affiché est celui utilisé dans les registres. Un compte désactivé ne peut plus
          entrer, mais son nom reste dans l&apos;historique ; il passe en fin de liste et
          « Réactiver » le rend employé. Seul le super admin peut modifier son propre compte.
        </p>
        <div className="table-wrap">
          <table className="stack-cards">
            <thead>
              <tr>
                <th>Identifiant</th>
                <th>Statut</th>
                <th>Nom et rôle</th>
                <th>Mot de passe</th>
                <th>Activité et accès</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} data-testid={`member-${m.username}`}>
                  <td className="stack-title">{m.username}</td>
                  <td className="stack-aside">
                    <span className="badges">
                      <span className={BADGE[roleOf(m)]}>{LABELS[roleOf(m)]}</span>
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
                          roleOf(m) !== "desactive" && (
                            <select name="role" defaultValue={roleOf(m)} aria-label="Rôle">
                              {ROLES.map((r) => (
                                <option key={r} value={r}>
                                  {LABELS[r]}
                                </option>
                              ))}
                            </select>
                          )
                        )}
                        <button className="btn btn-small" type="submit">
                          Enregistrer
                        </button>
                      </form>
                    )}
                  </td>
                  <td>{m.id !== me.id && !m.superAdmin && <ResetPasswordForm id={m.id} />}</td>
                  <td>
                    <div className="row-actions">
                      <Link className="btn btn-small btn-primary" href={at(`/membres/${m.id}`)}>
                        <ScrollText size={14} /> Activité
                      </Link>
                      {m.id !== me.id && !m.superAdmin && (
                        <ActiveToggleForm id={m.id} name={m.name} active={roleOf(m) !== "desactive"} />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} total={total} path={at("/membres")} label="Pages des comptes" />
      </section>
    </>
  );
}
