import { Hourglass } from "lucide-react";
import { redirect } from "next/navigation";
import { currentMember, STAFF } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function Attente() {
  const member = await currentMember();
  if (!member) redirect("/connexion");
  if (STAFF.includes(member.role)) redirect("/");
  const refused = member.role === "refuse";

  return (
    <main className="gate">
      <div className="gate-card">
        <span className="brand-mark" aria-hidden="true">
          <Hourglass size={30} />
        </span>
        <div className="eyebrow">Comptoir de chasse</div>
        <h1>{refused ? "Accès refusé" : "En attente"}</h1>
        <p className="muted">
          {refused
            ? "La gérance n'a pas validé ton accès au comptoir."
            : `Bienvenue, ${member.name}. Un gérant doit valider ton accès avant que tu puisses entrer au comptoir.`}
        </p>
        <form action="/api/auth/logout" method="post">
          <button className="btn" type="submit" style={{ marginTop: 20 }}>
            Se déconnecter
          </button>
        </form>
      </div>
    </main>
  );
}
