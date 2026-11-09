import { count } from "drizzle-orm";
import { redirect } from "next/navigation";
import { FirstGerantForm, LoginForm } from "@/components/auth-forms";
import { BrandMark } from "@/components/brand";
import { currentMember } from "@/lib/auth/session";
import { getDb, schema } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Connexion() {
  if (await currentMember()) redirect("/");
  const [{ total }] = await getDb().select({ total: count() }).from(schema.members);

  return (
    <main className="gate">
      <div className="gate-card">
        <BrandMark size={34} />
        <div className="eyebrow">Keizaal · Bordeciel</div>
        <h1>
          Comptoir <span>de Chasse</span>
        </h1>
        <p className="muted">Le registre des marchands et des chasseurs</p>
        <div className="gate-divider" aria-hidden="true">
          ◆ ━━━ ✦ ━━━ ◆
        </div>
        {total === 0 ? <FirstGerantForm /> : <LoginForm />}
        <p className="small muted">Accès réservé aux gérants et aux employés autorisés.</p>
      </div>
    </main>
  );
}
