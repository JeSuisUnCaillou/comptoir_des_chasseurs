import type { ReactNode } from "react";

export function PageHead({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <header className="page-head">
      {eyebrow && <div className="eyebrow">{eyebrow}</div>}
      <h1>{title}</h1>
      <p className="muted" style={{ margin: 0 }}>
        {children ?? "Les comptes et les échanges de la boutique"}
      </p>
    </header>
  );
}
