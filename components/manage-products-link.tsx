import Link from "next/link";
import { Settings2 } from "lucide-react";
import { shopPath } from "@/lib/paths";

/**
 * A gérant's « Gérer les marchandises » button, beside the page title of
 * Tarifs and Inventaire: same button, same place on both.
 */
export function ManageProductsLink({ shop }: { shop: string }) {
  return (
    <Link className="btn" href={shopPath(shop, "/marchandises")}>
      <Settings2 size={16} /> Gérer les marchandises
    </Link>
  );
}
