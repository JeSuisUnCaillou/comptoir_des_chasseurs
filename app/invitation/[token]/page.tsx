import Link from "next/link";
import { BrandMark } from "@/components/brand";
import { InvitationSignupForm, JoinShopForm } from "@/components/shop-forms";
import { logout } from "@/app/connexion/actions";
import { RETURN_PARAM, loginUrl } from "@/lib/auth/return-path";
import { currentAccount } from "@/lib/auth/session";
import { discordConfigured } from "@/lib/auth/discord";
import { SPENT, invitationOf } from "@/lib/invitations";
import { invitationPath } from "@/lib/paths";

export const dynamic = "force-dynamic";

/**
 * /invitation/<token>: the link the super admin gave someone to run a new
 * shop, or a gérant to join theirs as an employé. Signed in, they take it with
 * their account; otherwise they enter with Discord, create an account, or
 * sign in first.
 */
export default async function Invitation({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const token = (await params).token.slice(0, 100);
  const invitation = await invitationOf(token);
  const shop = invitation?.shop;
  const asGerant = invitation?.role === "gerant";
  const account = shop ? await currentAccount() : null;
  const here = invitationPath(token);
  const discordFailed = (await searchParams).discord === "erreur";
  const invited = shop && (
    <>
      Tu es invité à {asGerant ? "gérer" : "rejoindre"} la boutique <strong>« {shop.name} »</strong>
      {asGerant ? "" : " comme employé"}
      {invitation.name ? <>, sous le nom de <strong>{invitation.name}</strong></> : ""}.
    </>
  );

  return (
    <main className="gate">
      <div className="gate-card">
        <BrandMark />
        <div className="eyebrow">Keizaal · Bordeciel</div>
        <h1>Invitation</h1>
        {!shop ? (
          <>
            <p className="notice error" role="alert">
              {SPENT}
            </p>
            <Link className="btn" href="/">
              Aller à mes boutiques
            </Link>
          </>
        ) : account ? (
          <>
            <p>
              {account.name}, {invited}
            </p>
            <JoinShopForm
              token={token}
              label={asGerant ? `Devenir gérant de « ${shop.name} »` : `Rejoindre « ${shop.name} »`}
            />
            <form className="gate-logout" action={logout}>
              <input type="hidden" name={RETURN_PARAM} value={here} />
              <span className="small muted">Ce n&apos;est pas ton compte ? </span>
              <button className="btn btn-small btn-ghost" type="submit">
                Se déconnecter
              </button>
            </form>
          </>
        ) : (
          <>
            <p>{invited}</p>
            {discordFailed && (
              <p className="notice error" role="alert" style={{ textAlign: "left" }}>
                L&apos;entrée avec Discord n&apos;a pas abouti. Réessaie.
              </p>
            )}
            {discordConfigured() && (
              <>
                <a className="btn btn-discord" href={`/auth/discord?invitation=${encodeURIComponent(token)}`}>
                  Entrer avec Discord
                </a>
                <p className="gate-or muted">ou crée un compte avec un identifiant</p>
              </>
            )}
            {!discordConfigured() && <p>Crée ton compte pour y entrer.</p>}
            <InvitationSignupForm token={token} name={invitation.name ?? ""} />
            <p className="small">
              <Link href={loginUrl(here)}>J&apos;ai déjà un compte : me connecter</Link>
            </p>
          </>
        )}
      </div>
    </main>
  );
}
