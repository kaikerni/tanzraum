import type { Metadata } from "next";
import { Inter, Kaushan_Script } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const kaushan = Kaushan_Script({ subsets: ["latin"], weight: "400", variable: "--font-kaushan", display: "swap" });

export const metadata: Metadata = {
  title: "TanzRaum",
  description: "Vereinsverwaltung für karnevalistischen Tanzsport",
  icons: {
    icon: "/tanzraum-logo-mark.webp",
    apple: "/apple-touch-icon.png",
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
