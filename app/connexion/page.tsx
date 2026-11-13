import { redirect } from "next/navigation";
import { cancelPendingDiscord } from "@/app/connexion/actions";
import { FirstGerantForm, LoginForm } from "@/components/auth-forms";
import { BrandMark } from "@/components/brand";
import { discordConfigured, pendingDiscord } from "@/lib/auth/discord";
import { RETURN_PARAM, safeReturnPath } from "@/lib/auth/return-path";
import { authConfigured, currentMember } from "@/lib/auth/session";
import { accountCount } from "@/lib/members";

export const dynamic = "force-dynamic";

const DISCORD_ERRORS: Record<string, string> = {
  erreur: "La connexion avec Discord n'a pas abouti. Réessaie.",
  refuse: "Ce compte n'a plus accès à aucune boutique.",
};

export default async function Connexion({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const returnPath = safeReturnPath(params[RETURN_PARAM]);
  if (await currentMember()) redirect(returnPath);
  const total = await accountCount();
  const discord = discordConfigured() && total > 0;
  const pending = discord ? await pendingDiscord() : null;
  const discordError = DISCORD_ERRORS[String(params.discord)];

  return (
    <main className="gate">
      <div className="gate-card">
        <BrandMark />
        <div className="eyebrow">Keizaal · Bordeciel</div>
        <h1>
          Comptoir <span>des chasseurs</span>
        </h1>
        <p className="muted">Le registre des marchands et des chasseurs</p>
        <div className="gate-divider" aria-hidden="true">
          ◆ ━━━ ✦ ━━━ ◆
        </div>
        {!authConfigured() ? (
          <p className="notice error" role="alert" style={{ textAlign: "left" }}>
            Configuration incomplète : la variable AUTH_SECRET (32 caractères minimum) manque
            sur cet environnement Vercel.
          </p>
        ) : total === 0 ? (
          <FirstGerantForm />
        ) : (
          <>
            {discordError && (
              <p className="notice error" role="alert" style={{ textAlign: "left" }}>
                {discordError}
              </p>
            )}
            {pending && (
              <div className="notice" role="status" style={{ textAlign: "left" }}>
                <p style={{ marginTop: 0 }}>
                  Ton compte Discord <strong>{pending.name}</strong> n&apos;est encore lié à aucun
                  membre. Entre une fois avec ton identifiant et ton mot de passe : il sera lié à ton
                  compte, et Discord suffira ensuite.
                </p>
                <form action={cancelPendingDiscord}>
                  <button className="btn btn-ghost btn-small" type="submit">
                    Ce n&apos;est pas mon compte Discord
                  </button>
                </form>
              </div>
            )}
            <LoginForm returnPath={returnPath} />
            {discord && !pending && (
              <>
                <p className="gate-or muted">ou</p>
                <a
                  className="btn btn-discord"
                  href={`/auth/discord${returnPath === "/" ? "" : `?${RETURN_PARAM}=${encodeURIComponent(returnPath)}`}`}
                >
                  Se connecter avec Discord
                </a>
              </>
            )}
          </>
        )}
        <p className="small muted">Accès réservé aux gérants et aux employés autorisés.</p>
      </div>
    </main>
  );
}
