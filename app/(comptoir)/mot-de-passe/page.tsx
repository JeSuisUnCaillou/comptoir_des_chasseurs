import { PageHead } from "@/components/page-head";
import { ChangePasswordForm } from "@/components/change-password-form";
import { unlinkMyDiscord } from "@/app/(comptoir)/mot-de-passe/actions";
import { discordConfigured } from "@/lib/auth/discord";
import { requireMember } from "@/lib/auth/session";

const DISCORD_NOTICES: Record<string, { ok: boolean; message: string }> = {
  lie: { ok: true, message: "Ton compte Discord est lié : tu peux maintenant te connecter avec Discord." },
  delie: { ok: true, message: "Discord n'est plus lié à ton compte." },
  pris: { ok: false, message: "Ce compte Discord est déjà lié à un autre membre." },
  erreur: { ok: false, message: "La liaison avec Discord n'a pas abouti. Réessaie." },
};

export default async function MotDePasse({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const member = await requireMember();
  const notice = DISCORD_NOTICES[String((await searchParams).discord)];
  return (
    <>
      <PageHead eyebrow="Mon compte" title="Mot de passe">
        Identifiant : {member.username}
      </PageHead>
      <section className="panel" style={{ maxWidth: 520 }}>
        <ChangePasswordForm />
      </section>
      {(discordConfigured() || member.discordId) && (
        <section className="panel" style={{ maxWidth: 520, marginTop: 18 }}>
          <h2>Discord</h2>
          {notice && (
            <p className={`notice ${notice.ok ? "" : "error"}`} role={notice.ok ? "status" : "alert"}>
              {notice.message}
            </p>
          )}
          {member.discordId ? (
            <>
              <p>
                Lié au compte Discord <strong>{member.discordName}</strong> : tu peux te connecter
                avec Discord ou avec ton mot de passe.
              </p>
              <form action={unlinkMyDiscord}>
                <button className="btn btn-ghost" type="submit">
                  Délier Discord
                </button>
              </form>
            </>
          ) : (
            <>
              <p className="muted">
                Lie ton compte Discord pour te connecter avec lui, sans mot de passe.
              </p>
              <a className="btn" href="/auth/discord?lier">
                Lier mon compte Discord
              </a>
            </>
          )}
        </section>
      )}
    </>
  );
}
