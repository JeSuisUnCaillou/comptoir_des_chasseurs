"use client";

import { useParams } from "next/navigation";
import { shopPath } from "@/lib/paths";

/** In a client component under /[boutique]: the address of `path` in the shop being visited. */
export function useShopPath() {
  const { boutique } = useParams<{ boutique: string }>();
  return (path: string) => shopPath(boutique, path);
}
