import {
  Home,
  Building2,
  Calendar,
  Activity,
  ClipboardCheck,
  ShieldCheck,
  Trophy,
  CalendarRange,
  Users,
  FileSignature,
  Handshake,
  Globe,
  Folder,
  Car,
  Music,
  Shirt,
  Wallet,
  BarChart3,
  Settings2,
  Settings,
  CreditCard,
  Newspaper,
  Store,
  Flag,
  Receipt,
  Megaphone,
  LifeBuoy,
  Medal,
  Eye,
  FileText,
  Sparkles,
  MessageCircle,
  MessagesSquare,
  MessageSquareMore,
  ShieldAlert,
  Search,
  UserCheck,
  UserPlus,
  Map as MapIcon,
  Theater,
  Scale,
  GraduationCap,
  MessageSquareText as TreffIcon,
  Shield,
  History,
  ListOrdered,
  KeyRound,
  type LucideIcon, HardDrive } from "lucide-react";

export type Tarif = "free" | "basic" | "verein";

// Bereiche wie in bereiche_fuer_rolle / vereins_mitglieder.bereiche.
export type Bereich =
  | "mitglieder"
  | "anwesenheit"
  | "beitraege"
  | "material"
  | "saison"
  | "netzwerk"
  | "beitritt"
  // Vom Vereinsadmin je Rolle freigegeben (DB: verein_bereich_zugang)
  | "fahrgemeinschaften"
  | "statistiken";

// Rollenmarker aus meine_bereiche() -- nur von der offiziellen Vereinsrolle abgeleitet.
export type RollenMarker = "rolle_admin" | "rolle_trainer" | "rolle_betreuer" | "rolle_mitglied" | "rolle_eltern";

// Trainer-Netzwerk: nur vom Verein als Trainer zugeordnete Mitglieder mit Vereinslizenz (DB: netzwerk_modus())
export type NetzwerkModus = "trainer";

// Vom Verein ein-/ausschaltbare Bereiche (DB: vereins_module(), vereine.module_aus). Ausschalten loescht keine Daten.
export type VereinsModul =
  | "training"
  | "anwesenheit"
  | "kalender"
  | "saisonplanung"
  | "turniere"
  | "news"
  | "chat"
  | "dateien"
  | "fahrgemeinschaften"
  | "kostueme"
  | "finanzen"
  | "musik"
  | "statistiken"
  | "trainer_netzwerk"
  | "workshops";

export const VEREINS_MODULE: { id: VereinsModul; label: string; text: string }[] = [
  { id: "training", label: "Training", text: "Trainingszeiten, Zu- und Absagen" },
  { id: "anwesenheit", label: "Anwesenheit", text: "Anwesenheitslisten und Trainingsbeteiligung" },
  { id: "kalender", label: "Kalender", text: "Vereinstermine und Veranstaltungen" },
  { id: "saisonplanung", label: "Saisonplanung", text: "Alle Vereinstermine als Liste mit Treffpunkt" },
  { id: "turniere", label: "Turniere", text: "Turniere, Ausschreibungen, Starterlisten, Ergebnisse – inkl. Dashboard-Karten und Benachrichtigungen" },
  { id: "news", label: "News & Umfragen", text: "Vereinsnachrichten und Abstimmungen" },
  { id: "chat", label: "Vereinschat", text: "Gemeinsamer Chat aller Vereinsmitglieder" },
  { id: "dateien", label: "TeamCloud / Dokumente", text: "Dateien und Dokumente des Vereins" },
  { id: "fahrgemeinschaften", label: "Fahrgemeinschaften", text: "Mitfahrgelegenheiten organisieren" },
  { id: "kostueme", label: "Kostüme & Requisiten", text: "Kostüme, Requisiten und Material verwalten" },
  { id: "finanzen", label: "Finanzen", text: "Beiträge, Einnahmen und Ausgaben" },
  { id: "musik", label: "Musik", text: "Musiktitel für Training und Auftritte" },
  { id: "statistiken", label: "Statistiken", text: "Auswertungen – Inhalte und Zugriff legt der Vereinsadmin fest" },
  { id: "trainer_netzwerk", label: "Trainer-Netzwerk", text: "Austausch der Trainerinnen und Trainer" },
  { id: "workshops", label: "Workshops", text: "Workshops im Menü der Vereinsmitglieder – ausblenden schaltet sie nicht für TanzRaum ab" },
];

export type Zugriff = {
  tarif: Tarif;
  // Vom eigenen Verein ausgeschaltete Bereiche (DB: meine_module_aus())
  moduleAus?: string[];
  bereiche: string[];
  istPlattformAdmin: boolean;
  // Trainer-Netzwerk (Vereinslizenz, Trainer/Admin) bzw. TanzRaum-Netzwerk (Basic ohne Verein) – DB: netzwerk_modus()
  netzwerk?: NetzwerkModus | null;
  // Musikbereich plattformweit von der TanzRaum-Administration eingeschaltet (DB: musik_freigegeben())
  musikAn?: boolean;
  // Spotlights fuer den eigenen Tarif eingeschaltet (DB: spotlights_fuer_mich())
  spotlightsAn?: boolean;
  // TanzRaum Chat fuer den eigenen Tarif freigeschaltet (DB: chat_fuer_mich())
  chatAn?: boolean;
  // JuryRaum global eingeschaltet UND aktive JuryRaum-Mitgliedschaft (DB: juryraum_fuer_mich())
  juryraum?: boolean;
  // „Meine Navigation“: nur die persoenliche Reihenfolge (DB: meine_navigation()) – vergibt nie Rechte
  reihenfolge?: string[] | null;
  // TanzRaum Team (DB: meine_team_rechte()) – zeigt den Teambereich; jede Aktion prueft ihr Recht selbst
  team?: boolean;
  // Admin-Navigation: vom TanzRaum-Admin ausgeblendete Punkte (DB: meine_navigation_ausgeblendet()) – nur Anzeige
  ausgeblendet?: string[] | null;
  // Globale Nutzer-Navigation je Tarif (DB: plattform_einstellungen.navigation_tarife) – nur Anzeige
  navTarife?: Record<string, string[]> | null;
};

export type NavEintrag = {
  href: string;
  label: string;
  // Kurzform fuer die untere Leiste auf dem Handy
  kurz?: string;
  icon: LucideIcon;
  tarif: Tarif;
  // "plattform_admin" = nur TanzRaum-Plattformadministrator
  recht?: Bereich | RollenMarker | "plattform_admin";
  // Ausgeblendet, wenn jemand ausschliesslich diese Vereinsrollen hat (laut Navi-Vorgabe).
  nichtNurFuer?: RollenMarker[];
  // Nur sichtbar, wenn der Nutzer genau dieses Netzwerk nutzen darf (ersetzt Tarif/Recht-Pruefung).
  netzwerk?: NetzwerkModus;
  // Vereinsbereich, den der Verein ausschalten kann
  modul?: VereinsModul;
  // Unterpunkt eines Hauptpunkts (href des Hauptpunkts) – Seitenleiste zeigt ihn eingerueckt darunter
  eltern?: string;
  // Nur in der Seitenleiste; auf dem Handy erreichbar ueber die Reiter des Bereichs
  nurSeitenleiste?: boolean;
  // Nur bei eingeschaltetem JuryRaum mit Berechtigung
  jury?: boolean;
  // Nur wenn Spotlights fuer den eigenen Tarif eingeschaltet sind
  spotlights?: boolean;
  // Nur wenn der TanzRaum Chat fuer den eigenen Tarif freigeschaltet ist
  chat?: boolean;
  // Nur fuer Mitglieder des TanzRaum Teams
  team?: boolean;
};

export const NETZWERK = "/dashboard/netzwerk";
export const NACHRICHTEN = "/dashboard/nachrichten";
const VEREIN = "/dashboard/verein";

// Hauptstruktur: Dashboard · Mein Verein · TanzRaum-Netzwerk · Spotlight · Nachrichten · Turniere · JuryRaum (danach persoenliche Bereiche)
export const NAV: NavEintrag[] = [
  { href: "/dashboard", label: "Dashboard", icon: Home, tarif: "free" },
  // 🏢 Mein Verein (Vereinsbereiche ab Vereinslizenz)
  { href: VEREIN, label: "Mein Verein", icon: Building2, tarif: "basic" },
  { href: "/dashboard/mitglieder", label: "Mitglieder", icon: Users, tarif: "verein", recht: "mitglieder", eltern: VEREIN },
  { href: "/dashboard/verein#gruppen", label: "Gruppen", icon: Theater, tarif: "verein", eltern: VEREIN },
  { href: "/dashboard/training", label: "Training", icon: Activity, tarif: "verein", modul: "training", eltern: VEREIN },
  { href: "/dashboard/anwesenheit", label: "Anwesenheit", icon: ClipboardCheck, tarif: "verein", recht: "anwesenheit", modul: "anwesenheit", eltern: VEREIN },
  { href: "/dashboard/kalender", label: "Kalender", icon: Calendar, tarif: "basic", modul: "kalender", eltern: VEREIN },
  { href: "/dashboard/saisonplanung", label: "Saisonplanung", icon: CalendarRange, tarif: "verein", recht: "saison", modul: "saisonplanung", eltern: VEREIN },
  { href: "/dashboard/news", label: "News & Umfragen", kurz: "News", icon: Newspaper, tarif: "verein", modul: "news", eltern: VEREIN },
  { href: "/dashboard/mitgliedsantraege", label: "Mitgliedsanträge", icon: FileSignature, tarif: "verein", recht: "beitritt", eltern: VEREIN },
  { href: "/dashboard/fahrgemeinschaften", label: "Fahrgemeinschaften", icon: Car, tarif: "verein", recht: "fahrgemeinschaften", modul: "fahrgemeinschaften", eltern: VEREIN },
  // Verwalten: Bereich "Kostueme" (Vereinsverwaltung); alle anderen sehen hier, was ihnen ausgegeben ist
  { href: "/dashboard/kostueme", label: "Kostüme & Requisiten", kurz: "Kostüme", icon: Shirt, tarif: "verein", modul: "kostueme", eltern: VEREIN },
  { href: "/dashboard/finanzen", label: "Finanzen", icon: Wallet, tarif: "verein", recht: "beitraege", modul: "finanzen", eltern: VEREIN },
  { href: "/dashboard/statistiken", label: "Statistiken", icon: BarChart3, tarif: "verein", recht: "statistiken", modul: "statistiken", eltern: VEREIN },
  { href: "/dashboard/vereinsverwaltung", label: "Vereinsverwaltung", icon: Settings2, tarif: "verein", recht: "rolle_admin", eltern: VEREIN },
  // 🌐 TanzRaum-Netzwerk: FREE nur „Nutzer suchen“, alles weitere ab BASIC
  { href: NETZWERK, label: "TanzRaum-Netzwerk", kurz: "Netzwerk", icon: Globe, tarif: "free" },
  { href: `${NETZWERK}/suche`, label: "Nutzer suchen", icon: Search, tarif: "free", eltern: NETZWERK, nurSeitenleiste: true },
  { href: `${NETZWERK}/buddys`, label: "Meine Buddys", icon: UserCheck, tarif: "basic", eltern: NETZWERK, nurSeitenleiste: true },
  { href: `${NETZWERK}/anfragen`, label: "Buddy-Anfragen", icon: UserPlus, tarif: "basic", eltern: NETZWERK, nurSeitenleiste: true },
  { href: `${NETZWERK}/map`, label: "Map", icon: MapIcon, tarif: "basic", eltern: NETZWERK, nurSeitenleiste: true },
  { href: `${NETZWERK}/vereine`, label: "Vereine", icon: Building2, tarif: "basic", eltern: NETZWERK, nurSeitenleiste: true },
  // ✨ Spotlight: eigener Story-Bereich (ansehen alle Tarife laut Schalter, erstellen ab BASIC)
  { href: "/dashboard/spotlight", label: "Spotlight", icon: Sparkles, tarif: "free", spotlights: true },
  // 💬 Nachrichten: vollstaendiger Messenger ab BASIC (FREE: einzelne Direktnachricht aus dem Profil, keine Chatuebersicht)
  { href: NACHRICHTEN, label: "Nachrichten", icon: MessageCircle, tarif: "basic" },
  { href: `${NACHRICHTEN}/chats`, label: "Chats", icon: MessageCircle, tarif: "basic", eltern: NACHRICHTEN, nurSeitenleiste: true },
  { href: `${NACHRICHTEN}/gruppen`, label: "Gruppenchats", icon: MessagesSquare, tarif: "basic", eltern: NACHRICHTEN, nurSeitenleiste: true },
  { href: "/dashboard/turniere", label: "Turniere", icon: Trophy, tarif: "free", modul: "turniere" },
  // 🎓 Workshops, 💬 TanzRaum Treff (inkl. 📚 Wissensbeiträge – kein eigener Menüpunkt): mit Konto ab FREE (schreiben im Treff ab BASIC/VEREIN)
  { href: "/dashboard/workshops", label: "Workshops", icon: GraduationCap, tarif: "free", modul: "workshops" },
  { href: "/dashboard/treff", label: "TanzRaum Treff", kurz: "Treff", icon: TreffIcon, tarif: "free" },
  // 💬 TanzRaum Chat: oeffentlicher Live-Chat (Freigabe je Tarif durch den TanzRaum-Admin; Schutzpruefung vor Veroeffentlichung)
  { href: "/dashboard/chat", label: "TanzRaum Chat", kurz: "Chat", icon: MessageSquareMore, tarif: "free", chat: true },
  { href: "/juryraum/dashboard", label: "JuryRaum", icon: Scale, tarif: "free", jury: true },
  // Persoenliche und weitere Bereiche
  { href: "/dashboard/trainer-netzwerk", label: "Trainer-Netzwerk", icon: Handshake, tarif: "verein", netzwerk: "trainer", modul: "trainer_netzwerk" },
  { href: "/dashboard/dateien", label: "TeamCloud", icon: Folder, tarif: "basic", modul: "dateien" },
  // Community-Marktplatz fuer alle (keine Vereinsfunktion)
  { href: "/dashboard/boerse", label: "TanzRaum Börse", kurz: "Börse", icon: Store, tarif: "free" },
  { href: "/dashboard/musik", label: "Musik", icon: Music, tarif: "basic", nichtNurFuer: ["rolle_betreuer", "rolle_eltern"], modul: "musik" },
  { href: "/dashboard/team", label: "TanzRaum Team", kurz: "Team", icon: Shield, tarif: "free", team: true },
  { href: "/dashboard/admin", label: "TanzRaum-Administration", icon: ShieldCheck, tarif: "free", recht: "plattform_admin" },
  { href: "/dashboard/tarif", label: "Mein Tarif", kurz: "Tarif", icon: CreditCard, tarif: "free" },
  { href: "/dashboard/einstellungen", label: "Einstellungen", icon: Settings, tarif: "free" },
];

// Eigene Navigation der TanzRaum-Administration: nur Plattform-Aufgaben – keine Vereins-, Trainings- oder
// Mitgliederbereiche (die sieht die Administration ueber „Ansicht als …“ mit Beispieldaten).
export const ADMIN_NAV: NavEintrag[] = [
  { href: "/dashboard", label: "Dashboard", icon: Home, tarif: "free" },
  { href: "/dashboard/admin", label: "Administration", kurz: "Admin", icon: ShieldCheck, tarif: "free" },
  { href: "/dashboard/admin/meldungen", label: "Meldungen", icon: Flag, tarif: "free" },
  { href: "/dashboard/admin/statistik", label: "Plattform-Statistik", kurz: "Statistik", icon: BarChart3, tarif: "free" },
  { href: "/dashboard/admin/vereine", label: "Vereine", icon: Building2, tarif: "free" },
  { href: "/dashboard/admin/benutzer", label: "Benutzer", icon: Users, tarif: "free" },
  { href: "/dashboard/admin/tarife", label: "Tarife & Lizenzen", kurz: "Tarife", icon: CreditCard, tarif: "free" },
  { href: "/dashboard/admin/lizenzen", label: "Nutzer freischalten", kurz: "Freischalten", icon: KeyRound, tarif: "free" },
  { href: "/dashboard/admin/team", label: "TanzRaum Team", kurz: "Team", icon: Shield, tarif: "free" },
  { href: "/dashboard/workshops", label: "Workshops", icon: GraduationCap, tarif: "free" },
  { href: "/dashboard/treff", label: "TanzRaum Treff", kurz: "Treff", icon: TreffIcon, tarif: "free" },
  { href: "/dashboard/chat", label: "TanzRaum Chat", kurz: "Chat", icon: MessageSquareMore, tarif: "free" },
  { href: "/dashboard/admin/moderation", label: "Moderation", icon: ShieldAlert, tarif: "free" },
  { href: "/dashboard/admin/rechnungen", label: "Rechnungen", icon: Receipt, tarif: "free" },
  { href: "/dashboard/admin/boerse", label: "Börse-Moderation", kurz: "Börse", icon: Store, tarif: "free" },
  { href: "/dashboard/admin/ankuendigungen", label: "Ankündigungen", icon: Megaphone, tarif: "free" },
  { href: "/dashboard/admin/updates", label: "Updates & Neuigkeiten", kurz: "Updates", icon: Sparkles, tarif: "free" },
  { href: "/dashboard/admin/fernwartung", label: "Fernwartung", icon: LifeBuoy, tarif: "free" },
  { href: "/dashboard/admin/ehrungen", label: "Ehrungskatalog", kurz: "Ehrungen", icon: Medal, tarif: "free" },
  { href: "/dashboard/turniere", label: "Turnierkalender", kurz: "Turniere", icon: Trophy, tarif: "free" },
  { href: "/dashboard/netzwerk", label: "TanzRaum-Netzwerk", kurz: "Netzwerk", icon: Globe, tarif: "free" },
  { href: "/dashboard/spotlight", label: "Spotlight", icon: Sparkles, tarif: "free", spotlights: true },
  { href: "/dashboard/admin/vorschau", label: "Ansicht als …", kurz: "Ansicht", icon: Eye, tarif: "free" },
  { href: "/dashboard/admin/anbieter", label: "Anbieterangaben", icon: FileText, tarif: "free" },
  { href: "/dashboard/admin/navigation", label: "Navigation & Bereiche", kurz: "Navigation", icon: ListOrdered, tarif: "free" },
  { href: "/dashboard/admin/speicher", label: "Speicher & Kontingente", kurz: "Speicher", icon: HardDrive, tarif: "free" },
  { href: "/dashboard/admin/protokoll", label: "Protokoll", icon: History, tarif: "free" },
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

// Bereich vom eigenen Verein eingeschaltet? (Plattform-Admin sieht alles)
export function modulAn(zugriff: Zugriff, modul?: VereinsModul | null): boolean {
  if (!modul || zugriff.istPlattformAdmin) return true;
  return !(zugriff.moduleAus ?? []).includes(modul);
}

function nurAusgeschlosseneRollen(zugriff: Zugriff, ausgeschlossen: RollenMarker[]): boolean {
  const rollen = zugriff.bereiche.filter((b) => b.startsWith("rolle_") && b !== "rolle_sonstige");
  return rollen.length > 0 && rollen.every((r) => (ausgeschlossen as string[]).includes(r));
}

// Erlaubte Menuepunkte (ohne persoenliche Reihenfolge) – Grundlage fuer alle Rechte-Pruefungen der Anzeige
export function erlaubteNav(zugriff: Zugriff): NavEintrag[] {
  // Plattform-Admin (ohne „Ansicht als …“): nur die Admin-Navigation
  // Ausgeblendete Punkte entfallen nur in der Anzeige – die Berechtigung bleibt (Einstellungen immer sichtbar)
  if (zugriff.istPlattformAdmin) {
    const aus = new Set(zugriff.ausgeblendet ?? []);
    return ADMIN_NAV.filter((n) => (!n.spotlights || zugriff.spotlightsAn === true) && (!aus.has(n.href) || n.href === "/dashboard/einstellungen"));
  }
  return NAV.filter(
    (n) =>
      (n.href !== "/dashboard/musik" || zugriff.musikAn !== false) &&
      (!n.jury || zugriff.juryraum === true) &&
      (!n.spotlights || zugriff.spotlightsAn === true) &&
      (!n.chat || zugriff.chatAn === true) &&
      (!n.team || zugriff.team === true) &&
      (n.netzwerk ? zugriff.netzwerk === n.netzwerk : darf(zugriff, n.tarif, n.recht)) &&
      modulAn(zugriff, n.modul) &&
      (zugriff.istPlattformAdmin || !n.nichtNurFuer || !nurAusgeschlosseneRollen(zugriff, n.nichtNurFuer)) &&
      tarifSichtbar(zugriff, n),
  );
}

// Globale Nutzer-Navigation: Bereiche, die der TanzRaum-Admin fuer einen Tarif ausgeblendet hat (samt Unterpunkten).
// Nur Anzeige – jede Seite prueft ihren Zugriff selbst. Fehlt ein Bereich in der Einstellung, ist er fuer alle sichtbar.
export function tarifSichtbar(zugriff: Zugriff, n: NavEintrag): boolean {
  const regel = zugriff.navTarife ?? {};
  const pruefen = (href: string) => !Array.isArray(regel[href]) || regel[href].includes(zugriff.tarif);
  return pruefen(n.href) && (!n.eltern || pruefen(n.eltern));
}

// Bereiche fuer „Navigation & Bereiche“ (Hauptpunkte der Nutzer-Navigation ohne System, Admin und Team)
export const TARIF_BEREICHE = (): NavEintrag[] =>
  NAV.filter((n) => !n.eltern && !SYSTEM_NAV.has(n.href) && n.href !== "/dashboard" && n.recht !== "plattform_admin" && !n.team);

// Systembereiche bleiben fest am Ende (nicht sortierbar)
export const SYSTEM_NAV = new Set(["/dashboard/tarif", "/dashboard/einstellungen"]);

// Persoenliche Reihenfolge anwenden: sortiert NUR die bereits erlaubten Punkte. Unbekannte oder nicht (mehr)
// erlaubte Eintraege der gespeicherten Liste werden ignoriert; neu freigeschaltete Punkte erscheinen an ihrer
// Standardposition (direkt nach ihrem Vorgaenger in der Standardreihenfolge) und koennen dann verschoben werden.
export function inReihenfolge(eintraege: NavEintrag[], reihenfolge?: string[] | null): NavEintrag[] {
  const sortierbar = eintraege.filter((n) => !SYSTEM_NAV.has(n.href));
  const system = eintraege.filter((n) => SYSTEM_NAV.has(n.href));
  if (!reihenfolge || reihenfolge.length === 0) return [...sortierbar, ...system];
  const pos = new Map(reihenfolge.map((h, i) => [h, i]));
  let vorher = -1;
  const mitSchluessel = sortierbar.map((n, i) => {
    const p = pos.get(n.href);
    if (p !== undefined) vorher = p;
    return { n, k: p ?? vorher + 0.001 * (i + 1), i };
  });
  mitSchluessel.sort((a, b) => a.k - b.k || a.i - b.i);
  return [...mitSchluessel.map((x) => x.n), ...system];
}

export function sichtbareNav(zugriff: Zugriff): NavEintrag[] {
  return inReihenfolge(erlaubteNav(zugriff), zugriff.reihenfolge);
}

// Seitenleiste: Hauptpunkte mit ihren sichtbaren Unterpunkten. Die Vereinsbereiche erscheinen nur bei einer
// Vereinsmitgliedschaft (Tarif VEREIN) unter „Mein Verein“; ohne Verein stehen z. B. Kalender selbst in der Liste.
export type NavGruppe = { eintrag: NavEintrag; unterpunkte: NavEintrag[] };

export function navGruppen(zugriff: Zugriff, eintraege: NavEintrag[] = sichtbareNav(zugriff)): NavGruppe[] {
  const hrefs = new Set(eintraege.map((n) => n.href));
  const gruppiert = (n: NavEintrag) =>
    !!n.eltern && hrefs.has(n.eltern) && (n.eltern !== VEREIN || zugriff.istPlattformAdmin || zugriff.tarif === "verein");
  return eintraege
    .filter((n) => !gruppiert(n))
    .map((eintrag) => ({ eintrag, unterpunkte: eintraege.filter((n) => gruppiert(n) && n.eltern === eintrag.href) }));
}

// Pfad ohne Anker (z. B. /dashboard/verein#gruppen)
export function navPfad(href: string): string {
  return href.split("#")[0];
}

// Nur fuer diese Seiten werden "Alle anzeigen"-Links gesetzt; waechst mit jedem fertigen Modul.
export const FERTIGE_SEITEN = new Set<string>(["/dashboard", "/dashboard/verein", "/dashboard/mitglieder", "/dashboard/training", "/dashboard/anwesenheit", "/dashboard/kalender", "/dashboard/nachrichten", "/dashboard/einstellungen", "/dashboard/turniere", "/dashboard/saisonplanung", "/dashboard/trainer-netzwerk", "/dashboard/netzwerk", "/dashboard/admin", "/dashboard/tarif", "/dashboard/vereinsverwaltung", "/dashboard/news", "/dashboard/dateien", "/dashboard/statistiken", "/dashboard/kostueme", "/dashboard/musik", "/dashboard/finanzen", "/dashboard/fahrgemeinschaften", "/dashboard/boerse"]);

export function istFertig(href: string): boolean {
  return FERTIGE_SEITEN.has(href);
}
