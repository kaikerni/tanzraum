import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TanzRaum",
  description: "Vereinsverwaltung für karnevalistischen Tanzsport",
  icons: {
    icon: "/tanzraum-logo-mark.webp",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
