import { Pencil, X } from "lucide-react";
import Link from "next/link";
import { takeDownAnnouncement } from "@/app/[boutique]/annonces/actions";
import { PinIcon } from "@/components/pins";
import { PINS } from "@/lib/announcement-rules";
import { canActOn } from "@/lib/policies";
import type { AnnouncementEntry } from "@/lib/announcements";
import type { ShopMember } from "@/lib/auth/session";
import { shopPath } from "@/lib/paths";

const dateTime = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Paris",
});

// A slight, stable tilt per parchment, so the board looks hand-pinned.
const TILTS = [-1.6, 1.1, -0.6, 1.5, -1.2, 0.7];

/** The wooden board with its parchments; `back` is the page showing it, where editing one comes back to. */
export function AnnouncementBoard({
  announcements,
  member,
  back,
}: {
  announcements: AnnouncementEntry[];
  member: ShopMember;
  back: string;
}) {
  return (
    <div className="board">
      <div className="board-banner">✦ Les paroles demeurent ✦</div>
      {announcements.length === 0 ? (
        <p className="board-empty">Le tableau est vide. Accroche le premier parchemin !</p>
      ) : (
        <ul className="board-notes">
          {announcements.map((a) => (
            <li key={a.id}>
              <article
                className="parchment"
                aria-labelledby={`annonce-${a.id}`}
                style={{ rotate: `${TILTS[a.id % TILTS.length]}deg` }}
              >
                <span className="parchment-pin" title={PINS.find((p) => p.value === a.pin)?.label}>
                  <PinIcon pin={a.pin} size={52} />
                </span>
                {canActOn(member, a) && (
                  <div className="parchment-actions">
                    <Link
                      href={shopPath(member.shop.slug, `/annonces/${a.id}/modifier?retour=${encodeURIComponent(back)}`)}
                      className="icon-btn"
                      aria-label={`Modifier « ${a.title} »`}
                      title="Modifier"
                    >
                      <Pencil size={16} />
                    </Link>
                    <form action={takeDownAnnouncement}>
                      <input type="hidden" name="id" value={a.id} />
                      <button type="submit" className="icon-btn" aria-label={`Décrocher « ${a.title} »`} title="Décrocher">
                        <X size={16} />
                      </button>
                    </form>
                  </div>
                )}
                <div className="parchment-flourish" aria-hidden="true">
                  ❦
                </div>
                <h3 id={`annonce-${a.id}`}>{a.title}</h3>
                <div className="parchment-rule" aria-hidden="true">
                  ——— ✦ ———
                </div>
                <div className="parchment-body" tabIndex={0}>
                  {a.body}
                </div>
                <footer className="parchment-foot">
                  <em>Par {a.author}</em>
                  <time dateTime={a.createdAt.toISOString()}>{dateTime.format(a.createdAt)}</time>
                </footer>
              </article>
            </li>
          ))}
        </ul>
      )}
      <div className="board-banner board-banner-foot">⚔ Comptoir de chasse · Vendeaume ⚔</div>
    </div>
  );
}
