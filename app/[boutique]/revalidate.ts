import { revalidatePath } from "next/cache";

/**
 * After a write, every page of the shops shows fresh data: the stock, the
 * till and the register appear on several pages. Revalidating the whole
 * /[boutique] layout is cheap, since every page is dynamic.
 */
export function revalidateShop() {
  revalidatePath("/[boutique]", "layout");
}
