"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** A menu link, marked current on its page and on the `also` pages that belong to it. */
export function NavLink({ href, also = [], children }: { href: string; also?: string[]; children: ReactNode }) {
  const pathname = usePathname();
  const active = href === "/" ? pathname === "/" : [href, ...also].some((p) => pathname.startsWith(p));
  return (
    <Link href={href} aria-current={active ? "page" : undefined}>
      {children}
      <PendingSpinner />
    </Link>
  );
}

/** Spins inside the clicked link until its page has arrived. */
function PendingSpinner() {
  const { pending } = useLinkStatus();
  return pending ? <span className="link-spinner" data-testid="nav-pending" aria-hidden="true" /> : null;
}
