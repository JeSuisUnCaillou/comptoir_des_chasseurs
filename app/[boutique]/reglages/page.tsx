import { PageHead } from "@/components/page-head";
import { DeleteShopForm, ShopForm } from "@/components/shop-settings-forms";
import { requireMember } from "@/lib/auth/session";
import { FIRST_SHOP_SLUG } from "@/lib/paths";

/** /<slug>/reglages: a gérant renames the shop, moves it, or deletes it. */
export default async function Reglages() {
  const me = await requireMember(["gerant"]);
  const comptoir = me.shop.slug === FIRST_SHOP_SLUG;

  return (
    <>
      <PageHead title="Réglages de la boutique">Le nom et l&apos;adresse de la boutique.</PageHead>
      <section className="panel" style={{ maxWidth: 760 }} aria-label="La boutique">
        <h2>La boutique</h2>
        <ShopForm name={me.shop.name} slug={me.shop.slug} fixedSlug={comptoir} />
      </section>
      {!comptoir && (
        <section className="panel" style={{ maxWidth: 760 }} aria-label="Supprimer la boutique">
          <h2>Supprimer la boutique</h2>
          <p className="muted">
            Tout ce qu&apos;elle contient disparaît pour de bon : marchandises, stock, registre, annonces,
            fournisseurs. Les comptes de ses membres restent.
          </p>
          <DeleteShopForm name={me.shop.name} />
        </section>
      )}
    </>
  );
}
