import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { GameCountForm } from "@/components/game-count-form";
import { PageHead } from "@/components/page-head";
import { requireMember } from "@/lib/auth/session";
import { shopPath } from "@/lib/paths";
import { activeProducts, productAliases } from "@/lib/products";

/** /<slug>/inventaire/comptage: a gérant counts a chest of the game from screenshots of its inventory. */
export default async function ComptageDuJeu() {
  const member = await requireMember(["gerant"]);
  const [products, aliases] = await Promise.all([activeProducts(member.shopId), productAliases(member.shopId)]);

  return (
    <>
      <PageHead title="Compter depuis le jeu">
        Donne les captures d&apos;un coffre en jeu : l&apos;app lit chaque objet, tu vérifies, et le stock prend les
        comptes du coffre.
      </PageHead>
      <p>
        <Link className="btn btn-small btn-ghost" href={shopPath(member.shop.slug, "/inventaire")}>
          <ArrowLeft size={14} /> Retour à l&apos;inventaire
        </Link>
      </p>
      <section className="panel" style={{ maxWidth: 760 }} aria-label="Compter un coffre">
        <div className="eyebrow">Comptage</div>
        <h2>Compter un coffre</h2>
        <GameCountForm
          products={products.map(({ id, name, unit, stock }) => ({ id, name, unit, stock }))}
          aliases={aliases}
        />
      </section>
    </>
  );
}
