import type { TransactionKind } from "@/lib/db/schema";
import { isCashKind } from "@/lib/transaction-kinds";

/** The badge of a register line's kind, or of a stock movement made by hand. */
export function OperationBadge({ kind }: { kind: TransactionKind | "stock" }) {
  if (kind === "stock") return <span className="badge">Stock</span>;
  if (isCashKind(kind)) return <span className="badge badge-blue">Caisse</span>;
  return kind === "vente" ? <span className="badge badge-green">Vente</span> : <span className="badge badge-gold">Achat</span>;
}

/** A sale or buyback whose septims have not yet been put in or taken from the till. */
export function TillPendingBadge() {
  return <span className="badge badge-red">En attente de la caisse</span>;
}
