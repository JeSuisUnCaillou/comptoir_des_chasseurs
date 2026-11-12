import { redirect } from "next/navigation";
import { FirstGerantForm, LoginForm } from "@/components/auth-forms";
import { BrandMark } from "@/components/brand";
import { RETURN_PARAM, safeReturnPath } from "@/lib/auth/return-path";
import { authConfigured, currentMember } from "@/lib/auth/session";
import { accountCount } from "@/lib/members";

export const dynamic = "force-dynamic";

export default async function Connexion({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const returnPath = safeReturnPath((await searchParams)[RETURN_PARAM]);
  if (await currentMember()) redirect(returnPath);
  const total = await accountCount();

  return (
    <main className="gate">
      <div className="gate-card">
        <BrandMark />
        <div className="eyebrow">Keizaal · Bordeciel</div>
        <h1>
          Comptoir <span>des chasseurs</span>
        </h1>
        <p className="muted">Le registre des marchands et des chasseurs</p>
        <div className="gate-divider" aria-hidden="true">
          ◆ ━━━ ✦ ━━━ ◆
        </div>
        {!authConfigured() ? (
          <p className="notice error" role="alert" style={{ textAlign: "left" }}>
            Configuration incomplète : la variable AUTH_SECRET (32 caractères minimum) manque
            sur cet environnement Vercel.
          </p>
        ) : total === 0 ? (
          <FirstGerantForm />
        ) : (
          <LoginForm returnPath={returnPath} />
        )}
        <p className="small muted">Accès réservé aux gérants et aux employés autorisés.</p>
      </div>
    </main>
  );
}
