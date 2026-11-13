"use client";

import { X } from "lucide-react";
import { saveFeatured, saveFeaturedOrder } from "@/app/[boutique]/marchandises/actions";
import { SortableList } from "@/components/sortable-list";

/**
 * The featured products in Gérer les marchandises, in their order on the
 * Tarifs, each with its cross to take it back.
 */
export function FeaturedList({ products }: { products: { id: number; name: string }[] }) {
  return (
    <SortableList items={products} label="Produits phares actuels" className="featured-list" save={saveFeaturedOrder}>
      {(p, handle) => (
        <>
          {handle}
          <span className="featured-name">{p.name}</span>
          <form action={saveFeatured}>
            <input type="hidden" name="productId" value={p.id} />
            <button className="icon-btn" type="submit" title={`Retirer ${p.name}`} aria-label={`Retirer ${p.name}`}>
              <X size={16} />
            </button>
          </form>
        </>
      )}
    </SortableList>
  );
}
