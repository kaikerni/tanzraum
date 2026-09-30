import type { Metadata } from "next";
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

// Startseite immer sichtbar – angemeldete Nutzer sehen statt „Anmelden/Registrieren“ den Weg zum Dashboard.
// (Die installierte App startet direkt im Dashboard, siehe manifest start_url.)
export default async function Home() {
  const supabase = await createClient();
  const [
    {
      data: { user },
    },
    preise,
  ] = await Promise.all([supabase.auth.getUser(), getPreise(supabase)]);
  let vorname: string | null = null;
  if (user) {
    const { data } = await supabase.from("profiles").select("vorname").eq("id", user.id).maybeSingle();
    vorname = (data?.vorname as string | null) ?? "";
  }
  return <Startseite preise={preise} angemeldet={user ? { vorname } : null} />;
}
