import type { Metadata } from "next";
import type { ReactNode } from "react";
import { APP_LOGO } from "@/lib/logo";
import "./globals.css";

export const metadata: Metadata = {
  // A shop's layout replaces it with the shop's name.
  title: "Codex enchanté",
  description: "Stock, achats et ventes des boutiques d'un serveur de jeu de rôle",
  // A shop's layout replaces it with the shop's logo, when it has one.
  icons: { icon: { url: APP_LOGO, type: "image/svg+xml" } },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
