import Image from "next/image";
import Link from "next/link";
import { CalendarDays, Heart, MessageSquareText, Trophy, Users } from "lucide-react";
import { KaiBegleiter } from "@/components/kai/KaiBegleiter";
import type { KaiKontext } from "@/lib/kai/typen";

// Gemeinsamer Rahmen der oeffentlichen Auth-Seiten (Anmeldung, Registrierung, Passwort).
// Hintergrund (verblasste TanzRaum-Welt) kommt aus .auth-page in globals.css – auch fuer alle weiteren Auth-Seiten.
// Hier zusaetzlich: Original-Logo, Werte-Leiste (nur grosse Bildschirme) und derselbe Kai wie im angemeldeten Bereich.

const WERTE = [
  { icon: CalendarDays, text: "Organisieren" },
  { icon: Users, text: "Gemeinsam" },
  { icon: Trophy, text: "Turniere" },
  { icon: MessageSquareText, text: "Kommunizieren" },
  { icon: Heart, text: "Tanzsport leben" },
];

// Kai ohne Anmeldung: keine Personen- oder Vereinsdaten, Links nur auf oeffentliche Seiten
const KAI_OEFFENTLICH: KaiKontext = {
  vorname: "",
  istPlattformAdmin: false,
  hatVerein: false,
  istVereinsadmin: false,
  tarif: "free",
  bereiche: ["/", "/login", "/signup", "/passwort-vergessen", "/lizenz", "/kontakt"],
  vorschau: false,
};

export function AuthSeite({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-page auth-buehne">
      <Link href="/" aria-label="TanzRaum Startseite" className="auth-logo">
        <Image src="/tanzraum-logo-header.webp" alt="TanzRaum – Die Plattform für Tanzsport & Gemeinschaft" width={1392} height={207} priority className="h-auto w-full" />
      </Link>

      <main className="auth-mitte">{children}</main>

      <ul className="auth-werte" aria-label="TanzRaum">
        {WERTE.map(({ icon: Icon, text }) => (
          <li key={text}>
            <Icon size={22} className="text-brand-red" aria-hidden />
            {text}
          </li>
        ))}
      </ul>

      <div className="auth-kai">
        <KaiBegleiter kontext={KAI_OEFFENTLICH} oeffentlich />
      </div>
    </div>
  );
}
