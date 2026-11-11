"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * A menu link, marked current on its page and the pages under it, and on the
 * `also` pages that belong to it; on its page alone when `exact`.
 */
export function NavLink({
  href,
  also = [],
  exact = false,
  children,
}: {
  href: string;
  also?: string[];
  exact?: boolean;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const active = exact ? pathname === href : [href, ...also].some((p) => pathname.startsWith(p));
  return (
    <Link href={href} aria-current={active ? "page" : undefined}>
      {children}
      <PendingSpinner />
    </Link>
  );
}

/** Spins inside the clicked link until its page has arrived; any `Link` can hold one. */
export function PendingSpinner({ testId = "nav-pending" }: { testId?: string }) {
  const { pending } = useLinkStatus();
  return pending ? <span className="link-spinner" data-testid={testId} aria-hidden="true" /> : null;
}
