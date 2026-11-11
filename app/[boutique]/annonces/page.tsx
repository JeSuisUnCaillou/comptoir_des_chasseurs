import { Megaphone } from "lucide-react";
import { AnnouncementBoard } from "@/components/announcement-board";
import { AnnouncementForm } from "@/components/announcement-form";
import { PageHead } from "@/components/page-head";
import { Pagination } from "@/components/pagination";
import { requireMember } from "@/lib/auth/session";
import { shopPath } from "@/lib/paths";
import { announcementCount, announcementList, BOARD_SIZE } from "@/lib/announcements";
import { offsetOf, pageParam } from "@/lib/pagination";

export default async function Annonces({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const member = await requireMember();
  const at = (path: string) => shopPath(member.shop.slug, path);
  const page = pageParam((await searchParams).page);
  const [announcements, total] = await Promise.all([
    announcementList(member.shopId, { limit: BOARD_SIZE, offset: offsetOf(page, BOARD_SIZE) }),
    announcementCount(member.shopId),
  ]);

  return (
    <>
      <PageHead title="Annonces">Les annonces laissées par les membres du comptoir.</PageHead>
      <section className="panel announcement-panel">
        <div className="eyebrow">Annonce publique</div>
        <h2>
          <Megaphone size={18} style={{ verticalAlign: "-2px" }} /> Afficher un parchemin
        </h2>
        <p className="muted">Votre annonce sera visible sur le tableau de l&apos;accueil par tous les membres.</p>
        <AnnouncementForm />
      </section>
      <section className="section-gap">
        <AnnouncementBoard announcements={announcements} member={member} />
        <Pagination page={page} total={total} path={at("/annonces")} size={BOARD_SIZE} label="Pages des annonces" noun="annonce" />
      </section>
    </>
  );
}
