import {
  Home,
  Building2,
  Calendar,
  Activity,
  Trophy,
  Users,
  Handshake,
  MessageSquare,
  Folder,
  Car,
  Music,
  Wallet,
  BarChart3,
  Settings2,
  Settings,
  type LucideIcon,
} from "lucide-react";

// Schluessel wie in der DB-Funktion bereiche_fuer_rolle / Tabelle vereins_bereichsrechte.
export type Bereich =
  | "verein"
  | "kalender"
  | "training"
  | "turniere"
  | "mitglieder"
  | "trainer_netzwerk"
  | "nachrichten"
  | "dateien"
  | "fahrgemeinschaften"
  | "musik"
  | "finanzen"
  | "statistiken"
  | "vereinsverwaltung"
  | "training_verwalten"
  | "mitglieder_verwalten"
  | "dateien_hochladen"
  | "musik_verwalten"
  | "vereinsdaten_verwalten";

export type NavEintrag = {
  href: string;
  label: string;
  icon: LucideIcon;
  // null = fuer jeden angemeldeten Nutzer sichtbar
  bereich: Bereich | null;
};

export const NAV: NavEintrag[] = [
  { href: "/dashboard", label: "Dashboard", icon: Home, bereich: null },
  { href: "/dashboard/verein", label: "Mein Verein", icon: Building2, bereich: "verein" },
  { href: "/dashboard/kalender", label: "Kalender", icon: Calendar, bereich: "kalender" },
  { href: "/dashboard/training", label: "Training", icon: Activity, bereich: "training" },
  { href: "/dashboard/turniere", label: "Turniere", icon: Trophy, bereich: "turniere" },
  { href: "/dashboard/mitglieder", label: "Mitglieder", icon: Users, bereich: "mitglieder" },
  { href: "/dashboard/trainer-netzwerk", label: "Trainer-Netzwerk", icon: Handshake, bereich: "trainer_netzwerk" },
  { href: "/dashboard/nachrichten", label: "Nachrichten", icon: MessageSquare, bereich: "nachrichten" },
  { href: "/dashboard/dateien", label: "Dateien", icon: Folder, bereich: "dateien" },
  { href: "/dashboard/fahrgemeinschaften", label: "Fahrgemeinschaften", icon: Car, bereich: "fahrgemeinschaften" },
  { href: "/dashboard/musik", label: "Musik", icon: Music, bereich: "musik" },
  { href: "/dashboard/finanzen", label: "Finanzen", icon: Wallet, bereich: "finanzen" },
  { href: "/dashboard/statistiken", label: "Statistiken", icon: BarChart3, bereich: "statistiken" },
  { href: "/dashboard/vereinsverwaltung", label: "Vereinsverwaltung", icon: Settings2, bereich: "vereinsverwaltung" },
  { href: "/dashboard/einstellungen", label: "Einstellungen", icon: Settings, bereich: null },
];

// Nur fuer diese Seiten werden "Alle anzeigen"-Links gesetzt; waechst mit jedem fertigen Modul.
export const FERTIGE_SEITEN = new Set<string>(["/dashboard"]);

export function istFertig(href: string): boolean {
  return FERTIGE_SEITEN.has(href);
}

export function sichtbareNav(bereiche: ReadonlySet<string>): NavEintrag[] {
  return NAV.filter((n) => n.bereich === null || bereiche.has(n.bereich));
}
