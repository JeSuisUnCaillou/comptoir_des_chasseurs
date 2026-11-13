import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  // A shop's layout replaces it with the shop's name.
  title: "Codex enchanté",
  description: "Stock, achats et ventes des boutiques de Keizaal",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
