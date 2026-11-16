import { PageHead } from "@/components/page-head";
import { DeleteShopForm, LogoForm, ShopForm } from "@/components/shop-settings-forms";
import { requireMember } from "@/lib/auth/session";
import { shopLogoPath } from "@/lib/logo";
import { shopLogoVersion } from "@/lib/shop-logos";
import { isComptoir } from "@/lib/paths";

/** /<slug>/reglages: a gérant renames the shop, moves it, gives it a logo, or deletes it. */
export default async function Reglages() {
  const me = await requireMember(["gerant"]);
  const comptoir = isComptoir(me.shop);
  const logo = await shopLogoVersion(me.shopId);

  return (
    <>
      <PageHead title="Réglages de la boutique">Le nom, l&apos;adresse et le logo de la boutique.</PageHead>
      <section className="panel" style={{ maxWidth: 760 }} aria-label="La boutique">
        <h2>La boutique</h2>
        <ShopForm name={me.shop.name} slug={me.shop.slug} fixedSlug={comptoir} />
      </section>
      <section className="panel" style={{ maxWidth: 760 }} aria-label="Logo">
        <h2>Logo</h2>
        <p className="muted">En haut du menu, sur la carte de la boutique dans Mes boutiques, et dans l&apos;onglet du navigateur.</p>
        <LogoForm current={shopLogoPath(me.shop.slug, logo)} custom={logo !== null} />
      </section>
      {!comptoir && (
        <section className="panel" style={{ maxWidth: 760 }} aria-label="Supprimer la boutique">
          <h2>Supprimer la boutique</h2>
          <p className="muted">
            Tout ce qu&apos;elle contient disparaît pour de bon : marchandises, stock, registre, annonces,
            contacts. Les comptes de ses membres restent, mais ceux qui n&apos;ont pas d&apos;autre boutique ne pourront plus se connecter.
          </p>
          <DeleteShopForm name={me.shop.name} />
        </section>
      )}
    </>
  );
}
