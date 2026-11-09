import { redirect } from "next/navigation";
import { BrandMark } from "@/components/brand";
import { currentMember } from "@/lib/auth/session";
import { testLoginEnabled } from "@/lib/auth/test-login";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  discord: "La connexion avec Discord a échoué. Réessaie.",
  config: "La connexion Discord n'est pas encore configurée.",
};

export default async function Connexion({
  searchParams,
}: {
  searchParams: Promise<{ erreur?: string }>;
}) {
  if (await currentMember()) redirect("/");
  const { erreur } = await searchParams;

  return (
    <main className="gate">
      <div className="gate-card">
        <BrandMark size={34} />
        <div className="eyebrow">Keizaal · Bordeciel</div>
        <h1>
          Comptoir <span>de Chasse</span>
        </h1>
        <p className="muted">Le registre des marchands et des chasseurs</p>
        {erreur && ERRORS[erreur] && (
          <p className="notice error" role="alert">
            {ERRORS[erreur]}
          </p>
        )}
        <a className="btn btn-primary" href="/api/auth/discord">
          Entrer au comptoir avec Discord
        </a>
        {testLoginEnabled() && (
          <p className="small muted">Mode test : /api/auth/test-login?name=…</p>
        )}
        <p className="small muted">Accès réservé aux gérants et aux employés autorisés.</p>
      </div>
    </main>
  );
}
