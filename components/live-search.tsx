"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

const DELAY_MS = 250;

/**
 * Product name search that filters as you type: it writes its query parameter
 * (`name`, `q` by default) to the URL, back to page 1, after a short pause,
 * and the server page filters on it. Two searches on one page take two names.
 */
export function LiveSearch({ name = "q" }: { name?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlQuery = searchParams.get(name) ?? "";
  const [value, setValue] = useState(urlQuery);
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // The last query this field wrote to the URL; null while a keystroke waits to be written.
  const written = useRef<string | null>(urlQuery);

  // Once nothing typed is on its way, a URL that says something else was changed
  // elsewhere (a menu link, the back button): show its query.
  useEffect(() => {
    if (pending || written.current === null || urlQuery === written.current) return;
    written.current = urlQuery;
    setValue(urlQuery);
  }, [urlQuery, pending]);

  useEffect(() => () => clearTimeout(timer.current), []);

  function search(next: string) {
    setValue(next);
    written.current = null;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      // Read the address now, not at the keystroke: another search on the page may have changed it since.
      const query = new URLSearchParams(window.location.search);
      const q = next.trim();
      if (q) query.set(name, q);
      else query.delete(name);
      query.delete("page");
      written.current = q;
      const qs = query.toString();
      startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
    }, DELAY_MS);
  }

  return (
    <form className="inline-form filters live-search" role="search" aria-label="Recherche" onSubmit={(e) => e.preventDefault()}>
      <input
        name={name}
        type="search"
        value={value}
        onChange={(e) => search(e.target.value)}
        placeholder="Chercher une marchandise"
        aria-label="Chercher une marchandise"
        maxLength={100}
      />
    </form>
  );
}
