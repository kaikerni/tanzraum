import type { Metadata } from "next";
import { Inter, Kaushan_Script } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const kaushan = Kaushan_Script({ subsets: ["latin"], weight: "400", variable: "--font-kaushan", display: "swap" });

export const metadata: Metadata = {
  title: "TanzRaum",
  description: "Vereinsverwaltung für karnevalistischen Tanzsport",
  // Alle Symbole mit weissem Hintergrund (transparente Symbole erscheinen auf manchen Handys schwarz hinterlegt)
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "TanzRaum", statusBarStyle: "default" },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de" className={`${inter.variable} ${kaushan.variable}`}>
      <body>{children}</body>
    </html>
  );
}
