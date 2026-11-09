import { PageHead } from "@/components/page-head";
import { requireMember } from "@/lib/auth/session";

export default async function GrandLivre() {
  const member = await requireMember();
  return (
    <>
      <PageHead title="Grand livre" />
      <section className="panel">
        <div className="eyebrow">Bienvenue</div>
        <h2>Bonjour, {member.name}</h2>
        <p className="muted">
          Le registre du comptoir se construit. Les tarifs, l&apos;inventaire, les ventes et les
          rachats arrivent bientôt.
        </p>
      </section>
    </>
  );
}
