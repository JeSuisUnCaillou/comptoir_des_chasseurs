import { redirect } from "next/navigation";
import { cancelPendingDiscord } from "@/app/connexion/actions";
import { FirstGerantForm, LoginForm } from "@/components/auth-forms";
import { BrandMark } from "@/components/brand";
import { discordConfigured, pendingDiscord } from "@/lib/auth/discord";
import { RETURN_PARAM, safeReturnPath } from "@/lib/auth/return-path";
import { authConfigured, currentAccount } from "@/lib/auth/session";
import { accountCount, canSignIn } from "@/lib/members";

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
  // Signed in and able to enter a shop: nothing to do here. An account
  // deactivated everywhere sees the form, which refuses it.
  const account = await currentAccount();
  if (account && (await canSignIn(account))) redirect(returnPath);
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
          Registre <span>de Lomone</span>
        </h1>
        <p className="muted">Stock, achats et ventes de vos boutiques</p>
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
                  compte, et Discord suffira ensuite. Pas encore de compte ? Demande un lien
                  d&apos;invitation à un gérant de ta boutique.
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
