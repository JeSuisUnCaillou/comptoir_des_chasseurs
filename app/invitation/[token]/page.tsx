import Link from "next/link";
import { BrandMark } from "@/components/brand";
import { InvitationSignupForm, JoinShopForm } from "@/components/shop-forms";
import { logout } from "@/app/connexion/actions";
import { RETURN_PARAM, loginUrl } from "@/lib/auth/return-path";
import { currentAccount } from "@/lib/auth/session";
import { SPENT, invitedShop } from "@/lib/invitations";
import { invitationPath } from "@/lib/paths";

export const dynamic = "force-dynamic";

/**
 * /invitation/<token>: the link the super admin gave someone to run a new
 * shop. Signed in, they take it with their account; otherwise they create one,
 * or sign in first.
 */
export default async function Invitation({ params }: { params: Promise<{ token: string }> }) {
  const token = (await params).token.slice(0, 100);
  const shop = await invitedShop(token);
  const account = shop ? await currentAccount() : null;
  const here = invitationPath(token);

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
              {account.name}, tu es invité à gérer la boutique <strong>« {shop.name} »</strong>.
            </p>
            <JoinShopForm token={token} shopName={shop.name} />
            <form action={logout}>
              <input type="hidden" name={RETURN_PARAM} value={here} />
              <span className="small muted">Ce n&apos;est pas ton compte ? </span>
              <button className="btn btn-small btn-ghost" type="submit">
                Se déconnecter
              </button>
            </form>
          </>
        ) : (
          <>
            <p>
              Tu es invité à gérer la boutique <strong>« {shop.name} »</strong>. Crée ton compte pour y entrer.
            </p>
            <InvitationSignupForm token={token} />
            <p className="small">
              <Link href={loginUrl(here)}>J&apos;ai déjà un compte : me connecter</Link>
            </p>
          </>
        )}
      </div>
    </main>
  );
}
