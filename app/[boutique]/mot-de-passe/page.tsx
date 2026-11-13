import type { Metadata } from "next";
import { PageHead } from "@/components/page-head";
import { ChangePasswordForm } from "@/components/change-password-form";
import { requireMember } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Mot de passe" };

export default async function MotDePasse() {
  const member = await requireMember();
  return (
    <>
      <PageHead eyebrow="Mon compte" title="Mot de passe">
        Identifiant : {member.username}
      </PageHead>
      <section className="panel" style={{ maxWidth: 520 }}>
        <ChangePasswordForm />
      </section>
    </>
  );
}
