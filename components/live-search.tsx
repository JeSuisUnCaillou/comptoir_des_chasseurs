"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

const DELAY_MS = 250;

/**
 * Product name search that filters as you type: it writes `q` to the URL
 * (back to page 1) after a short pause, and the server page filters on it.
 */
export function LiveSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlQuery = searchParams.get("q") ?? "";
  const [value, setValue] = useState(urlQuery);
  const [seenQuery, setSeenQuery] = useState(urlQuery);
  const [, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // The last query this field wrote to the URL: its arrival must not overwrite what was typed since.
  const written = useRef(urlQuery);

  // The URL changed from elsewhere (a menu link, the back button): show its query.
  if (urlQuery !== seenQuery) {
    setSeenQuery(urlQuery);
    if (urlQuery !== written.current) {
      written.current = urlQuery;
      clearTimeout(timer.current);
      setValue(urlQuery);
    }
  }

  useEffect(() => () => clearTimeout(timer.current), []);

  function search(next: string) {
    setValue(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const query = new URLSearchParams(searchParams.toString());
      const q = next.trim();
      if (q) query.set("q", q);
      else query.delete("q");
      query.delete("page");
      written.current = q;
      const qs = query.toString();
      startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
    }, DELAY_MS);
  }

  return (
    <form className="inline-form filters live-search" role="search" aria-label="Recherche" onSubmit={(e) => e.preventDefault()}>
      <input
        name="q"
        type="search"
        value={value}
        onChange={(e) => search(e.target.value)}
        placeholder="Nom de la marchandise"
        aria-label="Chercher une marchandise"
        maxLength={100}
      />
    </form>
  );
}
