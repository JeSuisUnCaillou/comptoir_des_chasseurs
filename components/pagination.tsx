import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { pageCount, PAGE_SIZE } from "@/lib/pagination";

/**
 * Previous / next links for a server-paginated list. Other query parameters
 * (filters) are kept; `name` lets two lists on one page page separately.
 */
export function Pagination({
  page,
  total,
  path,
  params = {},
  name = "page",
  size = PAGE_SIZE,
  label = "Pagination",
}: {
  page: number;
  total: number;
  path: string;
  params?: Record<string, string | undefined>;
  name?: string;
  size?: number;
  label?: string;
}) {
  const pages = pageCount(total, size);
  if (pages <= 1) return null;
  const href = (p: number) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) if (value) query.set(key, value);
    if (p > 1) query.set(name, String(p));
    const qs = query.toString();
    return qs ? `${path}?${qs}` : path;
  };
  const current = Math.min(page, pages);
  return (
    <nav className="pagination" aria-label={label}>
      {current > 1 ? (
        <Link className="btn btn-small btn-ghost" href={href(current - 1)} rel="prev">
          <ChevronLeft size={14} /> Précédent
        </Link>
      ) : (
        <span />
      )}
      <span className="small muted">
        Page {current} sur {pages} · {total} ligne{total > 1 ? "s" : ""}
      </span>
      {current < pages ? (
        <Link className="btn btn-small btn-ghost" href={href(current + 1)} rel="next">
          Suivant <ChevronRight size={14} />
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
