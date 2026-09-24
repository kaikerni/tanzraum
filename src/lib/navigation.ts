import {
  Home,
  Building2,
  Calendar,
  Activity,
  ClipboardCheck,
  ClipboardList,
  ShieldCheck,
  Trophy,
  CalendarRange,
  Users,
  FileSignature,
  Handshake,
  MessageSquare,
  Folder,
  Car,
  Music,
  Shirt,
  Wallet,
  BarChart3,
  Settings2,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type Tarif = "free" | "basic" | "verein";

// Bereiche wie in bereiche_fuer_rolle / vereins_mitglieder.bereiche.
export type Bereich =
  | "mitglieder"
  | "anwesenheit"
  | "beitraege"
  | "material"
  | "trainingsplan"
  | "saison"
  | "netzwerk"
  | "beitritt";

// Rollenmarker aus meine_bereiche() -- nur von der offiziellen Vereinsrolle abgeleitet.
export type RollenMarker = "rolle_admin" | "rolle_trainer" | "rolle_betreuer" | "rolle_mitglied" | "rolle_eltern";

export type Zugriff = {
  tarif: Tarif;
  bereiche: string[];
  istPlattformAdmin: boolean;
};

export type NavEintrag = {
  href: string;
  label: string;
  icon: LucideIcon;
  tarif: Tarif;
  // "plattform_admin" = nur TanzRaum-Plattformadministrator
  recht?: Bereich | RollenMarker | "plattform_admin";
};

export const NAV: NavEintrag[] = [
  { href: "/dashboard", label: "Dashboard", icon: Home, tarif: "free" },
  { href: "/dashboard/verein", label: "Mein Verein", icon: Building2, tarif: "basic" },
  { href: "/dashboard/kalender", label: "Kalender", icon: Calendar, tarif: "basic" },
  { href: "/dashboard/training", label: "Training", icon: Activity, tarif: "basic" },
  { href: "/dashboard/anwesenheit", label: "Anwesenheit", icon: ClipboardCheck, tarif: "verein", recht: "anwesenheit" },
  { href: "/dashboard/trainingsplan", label: "Trainingsplan", icon: ClipboardList, tarif: "verein", recht: "trainingsplan" },
  { href: "/dashboard/turniere", label: "Turniere", icon: Trophy, tarif: "free" },
  { href: "/dashboard/saisonplanung", label: "Saisonplanung", icon: CalendarRange, tarif: "verein", recht: "saison" },
  { href: "/dashboard/mitglieder", label: "Mitglieder", icon: Users, tarif: "verein", recht: "mitglieder" },
  { href: "/dashboard/mitgliedsantraege", label: "Mitgliedsanträge", icon: FileSignature, tarif: "verein", recht: "beitritt" },
  { href: "/dashboard/trainer-netzwerk", label: "Trainer-Netzwerk", icon: Handshake, tarif: "verein", recht: "netzwerk" },
  { href: "/dashboard/nachrichten", label: "Nachrichten", icon: MessageSquare, tarif: "free" },
  { href: "/dashboard/dateien", label: "Dateien", icon: Folder, tarif: "basic" },
  { href: "/dashboard/fahrgemeinschaften", label: "Fahrgemeinschaften", icon: Car, tarif: "basic" },
  { href: "/dashboard/musik", label: "Musik", icon: Music, tarif: "basic" },
  { href: "/dashboard/kostueme", label: "Kostüme & Material", icon: Shirt, tarif: "verein", recht: "material" },
  { href: "/dashboard/finanzen", label: "Finanzen", icon: Wallet, tarif: "verein", recht: "beitraege" },
  { href: "/dashboard/statistiken", label: "Statistiken", icon: BarChart3, tarif: "verein", recht: "rolle_admin" },
  { href: "/dashboard/vereinsverwaltung", label: "Vereinsverwaltung", icon: Settings2, tarif: "verein", recht: "rolle_admin" },
  { href: "/admin", label: "TanzRaum-Administration", icon: ShieldCheck, tarif: "free", recht: "plattform_admin" },
  { href: "/dashboard/einstellungen", label: "Einstellungen", icon: Settings, tarif: "free" },
];

const TARIF_STUFE: Record<Tarif, number> = { free: 0, basic: 1, verein: 2 };

export function hatTarif(zugriff: Zugriff, mindestens: Tarif): boolean {
  return zugriff.istPlattformAdmin || TARIF_STUFE[zugriff.tarif] >= TARIF_STUFE[mindestens];
}

// Reihenfolge wie in der Spezifikation: Plattform-Admin > Tarif > Rolle/Bereich.
export function darf(zugriff: Zugriff, mindestTarif: Tarif, recht?: string): boolean {
  if (zugriff.istPlattformAdmin) return true;
  if (!hatTarif(zugriff, mindestTarif)) return false;
  return recht === undefined || zugriff.bereiche.includes(recht);
}

export function sichtbareNav(zugriff: Zugriff): NavEintrag[] {
  return NAV.filter((n) => darf(zugriff, n.tarif, n.recht));
}

// Nur fuer diese Seiten werden "Alle anzeigen"-Links gesetzt; waechst mit jedem fertigen Modul.
export const FERTIGE_SEITEN = new Set<string>(["/dashboard"]);

export function istFertig(href: string): boolean {
  return FERTIGE_SEITEN.has(href);
}
