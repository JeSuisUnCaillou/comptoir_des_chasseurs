import { Hourglass } from "lucide-react";
import Link from "next/link";
import { septims } from "@/lib/pricing";
import type { Till } from "@/lib/register";

/**
 * At the top of every page, for the member signed in: what they still have to
 * settle with the till or the chest, leading to their « À régler » page. Nothing when all is settled.
 */
export function ToSettleNotice({ mine, stock, href }: { mine: Till; stock: number; href: string }) {
  const deposit = mine.sales + mine.inflows;
  const take = mine.buybacks + mine.outflows;
  if (deposit + take === 0 && stock === 0) return null;
  const what = [
    deposit > 0 && `${septims(deposit)} à mettre en caisse`,
    take > 0 && `${septims(take)} à sortir de la caisse`,
    stock > 0 && `${stock} marchandise${stock >= 2 ? "s" : ""} à déposer`,
  ].filter(Boolean);
  return (
    <Link className="to-settle" href={href} data-testid="a-regler">
      <Hourglass size={16} aria-hidden />
      <span>
        <strong>À régler</strong>
        <span className="to-settle-detail">{what.join(" · ")}</span>
      </span>
    </Link>
  );
}
