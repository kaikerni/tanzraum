import type { Metadata, Viewport } from "next";
import { Inter, Kaushan_Script } from "next/font/google";
import "./globals.css";
import { ServiceWorkerAufraeumen } from "@/components/ServiceWorkerAufraeumen";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const kaushan = Kaushan_Script({ subsets: ["latin"], weight: "400", variable: "--font-kaushan", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL("https://tanzraum.app"),
  title: "TanzRaum",
  description: "Die digitale Plattform für den Tanzsport – für Fans, Tänzer, Trainer, Betreuer und Vereine.",
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

// Bildschirmtastatur verkleinert den Inhalt (statt ihn zu ueberdecken) – Chat-Eingabe bleibt sichtbar
export const viewport: Viewport = { width: "device-width", initialScale: 1, interactiveWidget: "resizes-content" };

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de" className={`${inter.variable} ${kaushan.variable}`}>
      <body>
        <ServiceWorkerAufraeumen />
        {children}
      </body>
    </html>
  );
}
