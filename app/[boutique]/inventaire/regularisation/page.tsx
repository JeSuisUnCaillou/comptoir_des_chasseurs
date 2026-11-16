import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { GameCountForm } from "@/components/game-count-form";
import { PageHead } from "@/components/page-head";
import { requireMember } from "@/lib/auth/session";
import { shopPath } from "@/lib/paths";
import { shopCategories } from "@/lib/categories";
import { activeProducts, productAliases } from "@/lib/products";

/** /<slug>/inventaire/regularisation (Régulariser le stock): a gérant counts a chest of the game from screenshots of its inventory. */
export default async function RegulariserLeStock() {
  const member = await requireMember(["gerant"]);
  const [products, aliases, categories] = await Promise.all([
    activeProducts(member.shopId),
    productAliases(member.shopId),
    shopCategories(member.shopId),
  ]);

  return (
    <>
      <PageHead title="Régulariser le stock">
        Donne les captures d&apos;un coffre en jeu : l&apos;app lit chaque objet, tu vérifies, et le stock prend les
        comptes du coffre.
      </PageHead>
      <p className="notice warning" role="note">
        Pendant la régularisation, que personne ne vende ni n&apos;achète : le stock prendra les comptes du coffre, et une
        vente faite entre-temps serait effacée.
      </p>
      <p>
        <Link className="btn btn-small btn-ghost" href={shopPath(member.shop.slug, "/inventaire")}>
          <ArrowLeft size={14} /> Retour à l&apos;inventaire
        </Link>
      </p>
      <section className="panel" aria-label="Compter un coffre du jeu">
        <div className="eyebrow">Régularisation</div>
        <h2>Compter un coffre du jeu</h2>
        <GameCountForm
          products={products.map(({ id, name, stock, categoryId, categoryName, categoryPosition }) => ({ id, name, stock, categoryId, categoryName, categoryPosition }))}
          aliases={aliases}
          categories={categories.map(({ id, name }) => ({ id, name }))}
        />
      </section>
    </>
  );
}
