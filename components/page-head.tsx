import type { ReactNode } from "react";

export function PageHead({
  eyebrow = "Registres · Employé",
  title,
  children,
}: {
  eyebrow?: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <header className="page-head">
      <div className="eyebrow">{eyebrow}</div>
      <h1>{title}</h1>
      <p className="muted" style={{ margin: 0 }}>
        {children ?? "Les comptes et les échanges du Comptoir de Chasse"}
      </p>
    </header>
  );
}
