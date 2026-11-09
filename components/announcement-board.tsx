import { X } from "lucide-react";
import { takeDownAnnouncement } from "@/app/(comptoir)/annonces/actions";
import { PinIcon } from "@/components/pins";
import { PINS } from "@/lib/announcement-rules";
import type { AnnouncementEntry } from "@/lib/announcements";
import type { Member } from "@/lib/db/schema";

const dateTime = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Paris",
});

// A slight, stable tilt per parchment, so the board looks hand-pinned.
const TILTS = [-1.6, 1.1, -0.6, 1.5, -1.2, 0.7];

/** The wooden board with its parchments. */
export function AnnouncementBoard({ announcements, member }: { announcements: AnnouncementEntry[]; member: Member }) {
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
                {(a.memberId === member.id || member.role === "gerant") && (
                  <form action={takeDownAnnouncement} className="parchment-remove">
                    <input type="hidden" name="id" value={a.id} />
                    <button type="submit" className="icon-btn" aria-label={`Décrocher « ${a.title} »`} title="Décrocher">
                      <X size={16} />
                    </button>
                  </form>
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
