"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";

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
  const ref = useRef<HTMLAnchorElement>(null);
  // On a phone the menu is one line that scrolls sideways: bring the current page into view.
  // Only the menu scrolls, never the page; a menu that does not scroll is left alone.
  useEffect(() => {
    const link = ref.current;
    const menu = link?.parentElement;
    if (!active || !link || !menu || menu.scrollWidth <= menu.clientWidth) return;
    menu.scrollLeft = link.offsetLeft - menu.offsetLeft - (menu.clientWidth - link.offsetWidth) / 2;
  }, [active]);
  return (
    <Link ref={ref} href={href} aria-current={active ? "page" : undefined}>
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
