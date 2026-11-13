import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  // Outside a shop, "<page> · Registre de Lomone"; a shop's layout replaces
  // the template with its own name.
  title: { default: "Registre de Lomone", template: "%s · Registre de Lomone" },
  description: "Stock, achats et ventes des boutiques de Keizaal",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
