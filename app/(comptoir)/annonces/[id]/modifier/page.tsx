import Link from "next/link";
import { notFound } from "next/navigation";
import { AnnouncementForm } from "@/components/announcement-form";
import { PageHead } from "@/components/page-head";
import { requireMember } from "@/lib/auth/session";
import { safeReturnPath } from "@/lib/auth/return-path";
import { editableAnnouncement } from "@/lib/announcements";

export default async function EditAnnouncement({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ retour?: string | string[] }>;
}) {
  const member = await requireMember();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const announcement = await editableAnnouncement(member, id);
  if (!announcement) notFound();
  const retour = (await searchParams).retour;
  const back = typeof retour === "string" ? safeReturnPath(retour) : "/annonces";

  return (
    <>
      <PageHead title="Modifier un parchemin">
        <Link href={back}>← {back === "/" ? "Grand livre" : "Annonces"}</Link>
      </PageHead>
      <section className="panel announcement-panel">
        <div className="eyebrow">Annonce publique</div>
        <h2>{announcement.title}</h2>
        <p className="muted">Le parchemin garde sa place et sa date sur le tableau.</p>
        <AnnouncementForm announcement={announcement} back={back} />
      </section>
    </>
  );
}
