"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

const DELAY_MS = 250;

/**
 * Product name search that filters as you type: it writes `q` to the URL
 * (back to page 1) after a short pause, and the server page filters on it.
 */
export function LiveSearch({ label = "Chercher une marchandise" }: { label?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(searchParams.get("q") ?? "");
  const [, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

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
      const qs = query.toString();
      startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
    }, DELAY_MS);
  }

  return (
    <form className="inline-form filters" role="search" aria-label={label} onSubmit={(e) => e.preventDefault()}>
      <input
        name="q"
        type="search"
        value={value}
        onChange={(e) => search(e.target.value)}
        placeholder="Nom de la marchandise"
        aria-label="Nom de la marchandise"
        maxLength={100}
      />
    </form>
  );
}
