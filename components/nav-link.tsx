"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function NavLink({ href, children }: { href: string; children: ReactNode }) {
  const pathname = usePathname();
  const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
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
