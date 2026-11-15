import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "PreçoBase — Gestão de Pesquisa de Preços",
    template: "%s · PreçoBase",
  },
  description:
    "Pesquisa, apuração e mapa de preços para contratações públicas, conforme a Lei nº 14.133/2021.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
