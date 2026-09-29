import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPreise } from "@/lib/tarife";
import { Startseite } from "@/components/start/Startseite";

export const metadata: Metadata = {
  title: "TanzRaum – Die digitale Plattform für den Tanzsport",
  description:
    "TanzRaum verbindet Tänzer, Fans, Trainer, Betreuer und Vereine: Training, Kalender, Chat, Spotlight, TanzRaum Connect und Vereinsverwaltung – an einem Ort. Kostenlos starten.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "de_DE",
    siteName: "TanzRaum",
    title: "TanzRaum – Dein digitaler Raum für Tanzsport",
    description: "Alles, was deinen Tanzsport, dein Team und deinen Verein digital verbindet – an einem Ort.",
    images: [{ url: "/og-tanzraum.jpg", width: 1200, height: 630, alt: "TanzRaum – Die Plattform für Tanzsport & Gemeinschaft" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "TanzRaum – Dein digitaler Raum für Tanzsport",
    description: "Training, Kalender, Chat, Spotlight und Vereinsverwaltung für den Tanzsport.",
    images: ["/og-tanzraum.jpg"],
  },
};

// Nicht angemeldet: oeffentliche Startseite. Angemeldet: direkt ins Dashboard.
export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");
  const preise = await getPreise(supabase);
  return <Startseite preise={preise} />;
}
