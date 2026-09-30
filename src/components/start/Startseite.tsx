import Image from "next/image";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  Bell,
  Car,
  Music,
  Newspaper,
  Shirt,
  Store,
  Wallet,
  Building2,
  CalendarDays,
  Check,
  ChevronDown,
  Gavel,
  Globe,
  Heart,
  Layers,
  Lock,
  MessageCircle,
  Settings2,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Trophy,
  UserRound,
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { euro, gratisMonate, type Preise } from "@/lib/tarife";
import { Einblenden } from "./Einblenden";
import { AppInstallieren } from "./AppInstallieren";
import { ChatScreen, DashboardScreen, InstallScreen, KalenderScreen, SpotlightScreen, Telefon, TrainingScreen, VereinScreen } from "./Telefon";

// Oeffentliche Startseite (immer sichtbar, auch angemeldet). Nur Demo-Inhalte, keine Datenbankdaten ausser den Preisen.

const BREITE = "mx-auto w-full max-w-[1200px] px-4 sm:px-6";
const KNOPF_PRIMAER =
  "inline-flex min-h-12 items-center justify-center rounded-xl bg-brand-red px-6 text-[15px] font-bold text-white shadow-[0_10px_24px_-12px_rgba(225,29,46,0.8)] transition-colors hover:bg-brand-red-deep";
const KNOPF_SEKUNDAER =
  "inline-flex min-h-12 items-center justify-center rounded-xl border border-brand-line bg-white px-6 text-[15px] font-bold text-brand-ink transition-colors hover:bg-brand-bg";

function Ueberschrift({ oben, titel, text, hell = false }: { oben?: string; titel: string; text?: string; hell?: boolean }) {
  return (
    <div className="mx-auto mb-10 max-w-[720px] text-center">
      {oben && <p className={`mb-2 text-[12.5px] font-bold uppercase tracking-[0.18em] ${hell ? "text-brand-gold-light" : "text-brand-red"}`}>{oben}</p>}
      <h2 className={`text-[28px] font-extrabold leading-tight tracking-tight sm:text-[38px] ${hell ? "text-white" : "text-brand-ink"}`}>{titel}</h2>
      {text && <p className={`mt-3 text-[15.5px] leading-relaxed sm:text-[17px] ${hell ? "text-white/75" : "text-brand-ink-soft"}`}>{text}</p>}
    </div>
  );
}

const ZIELGRUPPEN: { titel: string; claim: string; icon: LucideIcon; farbe: string; punkte: string[] }[] = [
  { titel: "Fans", claim: "Tanzsport erleben.", icon: Heart, farbe: "bg-brand-red-wash text-brand-red", punkte: ["Vereine und Turniere entdecken", "Spotlight und Neuigkeiten", "TanzRaum Connect – ganz ohne Verein"] },
  {
    titel: "Tänzer",
    claim: "Dein Tanzsport. Dein Raum.",
    icon: Sparkles,
    farbe: "bg-brand-gold-wash text-brand-gold",
    punkte: ["Training, Termine und Kalender", "Chat und Spotlight", "Profil mit freiwilliger Vereinsangabe"],
  },
  {
    titel: "Trainer & Betreuer",
    claim: "Dein Team. Eure Organisation.",
    icon: UsersRound,
    farbe: "bg-brand-blue-wash text-brand-blue",
    punkte: ["Tanzgruppen, Anwesenheit, Abmeldungen", "Gruppenchat, Infos und Dateien", "Vereinsfunktionen mit Verein-Lizenz"],
  },
  {
    titel: "Vereine",
    claim: "Euer Verein. Ein gemeinsamer TanzRaum.",
    icon: Building2,
    farbe: "bg-brand-green-wash text-brand-green",
    punkte: ["Mitglieder, Gruppen, Mitgliedsanträge", "Kalender, Kommunikation, Statistiken", "Support, Fernwartung, optional Turniere"],
  },
];

const FUNKTIONEN: { titel: string; icon: LucideIcon; farbe: string; punkte: string[]; bald?: boolean }[] = [
  { titel: "Training", icon: Activity, farbe: "text-brand-red bg-brand-red-wash", punkte: ["Trainingsübersicht", "An- und Abmeldung", "Anwesenheit", "Informationen"] },
  { titel: "Kalender", icon: CalendarDays, farbe: "text-brand-blue bg-brand-blue-wash", punkte: ["Training", "Veranstaltungen", "Turniere", "Termine"] },
  { titel: "Chat", icon: MessageCircle, farbe: "text-brand-green bg-brand-green-wash", punkte: ["Nachrichten", "Gruppen", "Dateien und Bilder", "TanzRaum-Smileys"] },
  { titel: "News & Umfragen", icon: Newspaper, farbe: "text-brand-blue bg-brand-blue-wash", punkte: ["Vereinsnachrichten", "Lesebestätigung", "Abstimmungen"] },
  { titel: "TanzRaum Connect", icon: Globe, farbe: "text-brand-purple bg-brand-purple-wash", punkte: ["Karte und Suche", "Kontakte", "Tanzsport-Community"] },
  { titel: "Spotlight", icon: Sparkles, farbe: "text-brand-gold bg-brand-gold-wash", punkte: ["Fotos mit Text und Smileys", "24 Stunden sichtbar", "Für Kontakte oder alle"] },
  { titel: "TanzRaum Börse", icon: Store, farbe: "text-brand-gold bg-brand-gold-wash", punkte: ["Kostüme, Schuhe, Requisiten", "Kaufen, tauschen, verschenken", "Kontakt über den Chat"] },
  { titel: "Fahrgemeinschaften", icon: Car, farbe: "text-brand-green bg-brand-green-wash", punkte: ["Fahrten anbieten und suchen", "Zu Turnier und Training", "Nur im eigenen Verein"] },
  { titel: "Kostüme & Requisiten", icon: Shirt, farbe: "text-brand-red bg-brand-red-wash", punkte: ["Inventar und Kostümsätze", "Ausgabe und Rückgabe", "Wer hat was – mit Rückgabedatum"] },
  { titel: "Finanzen", icon: Wallet, farbe: "text-brand-navy bg-brand-bg", punkte: ["Kassenbuch mit Belegen", "Mitgliedsbeiträge", "Export für die Kassenprüfung"] },
  { titel: "Vereinsverwaltung", icon: Settings2, farbe: "text-brand-navy bg-brand-bg", punkte: ["Mitglieder und Gruppen", "Mitgliedsanträge", "Rollen und Bereiche", "Statistiken"] },
  { titel: "Musik", icon: Music, farbe: "text-brand-purple bg-brand-purple-wash", punkte: ["Musik für Training und Auftritte", "Direkt im Browser hören"], bald: true },
];

const VORSCHAU = [
  { titel: "Dashboard", screen: <DashboardScreen /> },
  { titel: "Kalender", screen: <KalenderScreen /> },
  { titel: "Training", screen: <TrainingScreen /> },
  { titel: "Chat", screen: <ChatScreen /> },
  { titel: "Spotlight", screen: <SpotlightScreen /> },
  { titel: "Verein", screen: <VereinScreen /> },
];

const WARUM = [
  { titel: "Weniger Chaos", text: "Keine Informationen mehr verteilt über WhatsApp, Zettel, Kalender und verschiedene Apps." },
  { titel: "Alles an einem Ort", text: "Training, Termine, Kommunikation und Vereinsorganisation in einer Plattform." },
  { titel: "Für den Tanzsport gemacht", text: "Entwickelt mit Blick auf die Besonderheiten des Tanzsports." },
  { titel: "Mehr Übersicht", text: "Jeder sieht genau die Funktionen, die für ihn relevant sind." },
  { titel: "Flexibel", text: "Jeder Verein entscheidet selbst, welche Bereiche er benötigt." },
  { titel: "Miteinander verbunden", text: "Tänzer, Trainer, Betreuer, Fans und Vereine bleiben miteinander verbunden." },
];

const DATENSCHUTZ: { icon: LucideIcon; titel: string; text: string }[] = [
  { icon: Lock, titel: "Datenschutz", text: "Deine persönlichen Daten gehören dir. Kein Tracking, keine Werbung – Cookies nur, soweit technisch notwendig." },
  { icon: ShieldCheck, titel: "Sichere Datenverarbeitung", text: "Jede Rolle erhält nur die Daten und Funktionen, die sie benötigt. Zugriffe werden in der Datenbank geprüft." },
  { icon: UserRound, titel: "Kontrolle über persönliche Daten", text: "Profil privat stellen, Online-Status verbergen, Daten exportieren oder das Konto löschen – du entscheidest." },
  {
    icon: Building2,
    titel: "Getrennte Vereinsbereiche",
    text: "Vereinsinterne Daten bleiben im jeweiligen Verein. Der TanzRaum-Admin erhält keinen Zugriff auf persönliche Mitgliederdaten.",
  },
];

const FAQ: { frage: string; antwort: React.ReactNode }[] = [
  {
    frage: "Was ist TanzRaum?",
    antwort: "TanzRaum ist eine digitale Plattform für den Tanzsport – besonders für den karnevalistischen Tanzsport. Sie verbindet Tänzer, Fans, Trainer, Betreuer und Vereine an einem Ort: mit Training, Kalender, Chat, Spotlight, TanzRaum Connect, der TanzRaum Börse und Vereinsverwaltung.",
  },
  { frage: "Für wen ist TanzRaum?", antwort: "Für Fans, Tänzerinnen und Tänzer, Trainer und Betreuer sowie für Vereine." },
  {
    frage: "Brauche ich einen Verein?",
    antwort: "Nein. Mit FREE und BASIC nutzt du TanzRaum persönlich – ganz ohne Verein. Vereinsfunktionen gibt es, wenn dein Verein die Verein-Lizenz hat und dich aufnimmt.",
  },
  { frage: "Kann ich TanzRaum als Fan nutzen?", antwort: "Ja. Registriere dich kostenlos und entdecke Turniere, Vereine, Spotlights und die Tanzsport-Community." },
  {
    frage: "Kann ich TanzRaum als Tänzer ohne Verein nutzen?",
    antwort: "Ja. Du nutzt deine persönlichen Funktionen mit FREE oder BASIC. Im Profil kannst du freiwillig angeben, in welchem Verein du tanzt.",
  },
  {
    frage: "Was ist der Unterschied zwischen FREE und BASIC?",
    antwort: "FREE ist die kostenlose persönliche Nutzung. BASIC erweitert sie um zusätzliche persönliche Funktionen, zum Beispiel TanzRaum Connect mit Karte und Suche, einen eigenen Kalender und Dateien. Beide Tarife enthalten keine Vereinsverwaltung.",
  },
  {
    frage: "Was ist die Verein-Lizenz?",
    antwort: "Die Verein-Lizenz ist der einzige Weg, einen Verein in TanzRaum zu verwalten: Mitglieder, Tanzgruppen, Training, Kalender, Kommunikation, Mitgliedsanträge, Statistiken, Support und Fernwartung. Aufgenommene Mitglieder nutzen die Vereinsfunktionen über die Lizenz ihres Vereins.",
  },
  {
    frage: "Kann mein Verein TanzRaum nutzen, obwohl wir nicht an Turnieren teilnehmen?",
    antwort: "Ja. Turnierfunktionen sind optional. Viele Vereine nutzen TanzRaum nur für Training, Termine, Kommunikation und Organisation.",
  },
  {
    frage: "Kann ich Turnierfunktionen deaktivieren?",
    antwort: "Ja. Der Vereinsadmin schaltet in der Vereinsverwaltung unter „Bereiche“ die Turniere – oder andere Bereiche – aus. Sie verschwinden dann aus Navigation, Dashboard und Benachrichtigungen. Gespeicherte Daten bleiben erhalten.",
  },
  {
    frage: "Kann ich meinen Verein im Profil angeben?",
    antwort: "Ja. Im Profil gibt es das freiwillige Feld „Verein, in dem ich tanze“. Du kannst es jederzeit ändern oder löschen. Es ist nur eine Info – keine offizielle Zuordnung und ohne Rechte.",
  },
  {
    frage: "Was ist eine offizielle Vereinszuordnung?",
    antwort: "Offiziell Mitglied bist du, wenn dich ein Verein mit aktiver Verein-Lizenz aufnimmt – per Einladung oder Mitgliedsantrag. Jede Person kann offiziell genau einem Verein angehören; bei einem Wechsel gibt der bisherige Verein die Person frei.",
  },
  {
    frage: "Wie kann ich TanzRaum auf meinem Smartphone installieren?",
    antwort: (
      <>
        Tippe auf dieser Seite auf „App installieren“ – oder füge TanzRaum selbst zum Startbildschirm hinzu: auf dem iPhone über „Teilen“ → „Zum
        Home-Bildschirm“, auf Android über das Browser-Menü → „App installieren“. Einen App Store brauchst du nicht. Die Schritte findest du{" "}
        <a href="#app" className="font-semibold text-brand-red underline">
          weiter oben
        </a>
        .
      </>
    ),
  },
  {
    frage: "Wie schützt TanzRaum meine Daten?",
    antwort: (
      <>
        TanzRaum wurde mit besonderem Fokus auf Datenschutz entwickelt: Rollen und Berechtigungen trennen persönliche Daten und Vereinsdaten, das
        Geburtsdatum ist nie öffentlich, und die TanzRaum-Administration sieht keine persönlichen Mitgliederdaten oder privaten Chats. Details stehen in
        der{" "}
        <Link href="/datenschutz" className="font-semibold text-brand-red underline">
          Datenschutzerklärung
        </Link>
        .
      </>
    ),
  },
];

function Preiszeile({ preise, tarif }: { preise: Preise | null; tarif: "basic" | "verein" }) {
  if (!preise) return <p className="text-[14px] text-brand-ink-soft">Preise siehe Lizenzen</p>;
  const gratis = gratisMonate(preise, tarif);
  return (
    <div>
      <p className="text-[34px] font-extrabold leading-none tracking-tight text-brand-ink">
        {euro(preise[tarif].monat)}
        <span className="text-[14px] font-semibold text-brand-ink-soft"> / Monat</span>
      </p>
      <p className="mt-1.5 text-[13px] text-brand-ink-soft">
        oder {euro(preise[tarif].jahr)} / Jahr
        {gratis > 0 && <span className="ml-1.5 rounded-full bg-brand-green-wash px-2 py-0.5 text-[11.5px] font-bold text-brand-green">{gratis} Monate gratis</span>}
      </p>
    </div>
  );
}

export function Startseite({ preise, angemeldet = null }: { preise: Preise | null; angemeldet?: { vorname: string | null } | null }) {
  const tarife = [
    {
      name: "FREE",
      untertitel: "Kostenlose persönliche Nutzung",
      preis: (
        <p className="text-[34px] font-extrabold leading-none tracking-tight text-brand-ink">
          0 €<span className="text-[14px] font-semibold text-brand-ink-soft"> für immer</span>
        </p>
      ),
      punkte: ["Persönliche TanzRaum-Funktionen", "Turnierkalender und Spotlight", "Freiwillige Profilangabe „Verein, in dem ich tanze“", "Keine offizielle Vereinszuordnung", "Keine Vereinsverwaltung"],
      knopf: { text: "Kostenlos starten", href: "/signup", primaer: false },
      hervorgehoben: false,
    },
    {
      name: "BASIC",
      untertitel: "Für deinen persönlichen Tanzsport",
      preis: <Preiszeile preise={preise} tarif="basic" />,
      punkte: ["Alle FREE-Funktionen", "TanzRaum Connect mit Karte und Suche", "Eigener Kalender und Dateien", "Freiwillige Profilangabe „Verein, in dem ich tanze“", "Keine Vereinsverwaltung"],
      knopf: { text: "BASIC wählen", href: "/signup", primaer: false },
      hervorgehoben: false,
    },
    {
      name: "VEREIN",
      untertitel: "Die komplette Vereinsverwaltung",
      preis: <Preiszeile preise={preise} tarif="verein" />,
      punkte: [
        "Vereinsverwaltung und Mitgliederverwaltung",
        "Tanzgruppen, Training, Kalender",
        "Kommunikation und Mitgliedsanträge",
        "Fahrgemeinschaften, Kostüme & Requisiten",
        "Finanzen: Kassenbuch und Beiträge",
        "Vereinsstatistiken, Support und Fernwartung",
        "Optional Turnierfunktionen",
      ],
      knopf: { text: "Verein-Lizenz entdecken", href: "/signup?ziel=verein", primaer: true },
      hervorgehoben: true,
    },
  ];

  return (
    <div className="min-h-full overflow-x-hidden bg-white text-brand-ink">
      {/* Kopfzeile */}
      <header className="sticky top-0 z-40 border-b border-brand-line/70 bg-white/85 backdrop-blur">
        <div className={`${BREITE} flex h-16 items-center justify-between gap-3`}>
          <Link href="/" aria-label="TanzRaum Startseite" className="shrink-0">
            <Image src="/tanzraum-logo-mark.webp" alt="TanzRaum" width={1254} height={1254} priority className="h-10 w-10 sm:hidden" />
            <Image src="/tanzraum-logo-header.webp" alt="TanzRaum" width={1392} height={207} priority className="hidden h-10 w-auto sm:block" />
          </Link>
          <nav aria-label="Seitenbereiche" className="hidden items-center gap-6 text-[14px] font-semibold text-brand-ink-soft lg:flex">
            <a href="#funktionen" className="hover:text-brand-ink">
              Funktionen
            </a>
            <a href="#preise" className="hover:text-brand-ink">
              Preise
            </a>
            <a href="#app" className="hover:text-brand-ink">
              App
            </a>
            <a href="#faq" className="hover:text-brand-ink">
              FAQ
            </a>
          </nav>
          <div className="flex items-center gap-2">
            {angemeldet ? (
              <Link href="/dashboard" className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-brand-red px-4 text-[14px] font-bold text-white hover:bg-brand-red-deep">
                Zum Dashboard <ArrowRight size={16} />
              </Link>
            ) : (
              <>
                <Link href="/login" className="inline-flex min-h-10 items-center rounded-xl px-3 text-[14px] font-semibold text-brand-ink hover:bg-brand-bg">
                  Anmelden
                </Link>
                <Link href="/signup" className="inline-flex min-h-10 items-center rounded-xl bg-brand-red px-4 text-[14px] font-bold text-white hover:bg-brand-red-deep">
                  Registrieren
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative isolate overflow-hidden">
          <Image src="/tanzraum-hero.webp" alt="" fill priority sizes="100vw" className="-z-20 object-cover object-[80%_center] opacity-25 sm:opacity-100" />
          <div className="absolute inset-0 -z-10 bg-gradient-to-r from-white via-white/95 to-white/40" />
          <div className={`${BREITE} grid grid-cols-1 items-center gap-10 py-12 sm:py-16 lg:grid-cols-[1.1fr_1fr] lg:py-20`}>
            <div>
              <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-brand-red-wash px-3 py-1 text-[12.5px] font-bold text-brand-red">
                <Sparkles size={14} /> Für Tanzsport &amp; Gemeinschaft
              </p>
              <h1 className="text-[40px] font-extrabold leading-[1.05] tracking-tight text-brand-ink sm:text-[56px]">
                TanzRaum
                <span className="mt-1 block font-[family-name:var(--font-script)] text-[34px] font-normal leading-tight text-brand-red sm:text-[48px]">
                  Dein digitaler Raum für Tanzsport.
                </span>
              </h1>
              <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-brand-ink-soft sm:text-[19px]">
                Alles, was deinen Tanzsport, dein Team und deinen Verein digital verbindet – an einem Ort.
              </p>
              {angemeldet && (
                <p className="mt-5 text-[16px] font-semibold text-brand-ink">Schön, dass du da bist{angemeldet.vorname ? `, ${angemeldet.vorname}` : ""}! 👋</p>
              )}
              <div className="mt-7 flex flex-wrap items-start gap-3">
                {angemeldet ? (
                  <Link href="/dashboard" className={`${KNOPF_PRIMAER} gap-2`}>
                    Zum Dashboard <ArrowRight size={18} />
                  </Link>
                ) : (
                  <>
                    <Link href="/signup" className={KNOPF_PRIMAER}>
                      Jetzt registrieren
                    </Link>
                    <Link href="/login" className={KNOPF_SEKUNDAER}>
                      Anmelden
                    </Link>
                  </>
                )}
                <AppInstallieren variante="klein" />
                <a href="#was-ist-tanzraum" className="inline-flex min-h-12 items-center gap-1.5 px-2 text-[15px] font-semibold text-brand-ink-soft hover:text-brand-ink">
                  Mehr über TanzRaum <ChevronDown size={16} />
                </a>
              </div>
              <p className="mt-5 text-[13px] text-brand-ink-soft">Für Fans · Tänzer · Trainer &amp; Betreuer · Vereine</p>
            </div>

            <div className="relative mx-auto h-[540px] w-full max-w-[420px]">
              <Telefon className="relative z-10">
                <DashboardScreen />
              </Telefon>
              <div className="tr-schweben absolute left-0 top-16 z-20 flex items-center gap-2 rounded-2xl border border-brand-line bg-white px-3.5 py-2.5 text-[13px] font-semibold shadow-[var(--shadow-hover)] sm:-left-4">
                <Activity size={16} className="text-brand-red" /> Training heute 18:00
              </div>
              <div
                className="tr-schweben absolute right-0 top-40 z-20 flex items-center gap-2 rounded-2xl border border-brand-line bg-white px-3.5 py-2.5 text-[13px] font-semibold shadow-[var(--shadow-hover)] sm:-right-6"
                style={{ animationDelay: "1.2s" }}
              >
                <Users size={16} className="text-brand-green" /> 12 Tänzer anwesend
              </div>
              <div
                className="tr-schweben absolute bottom-24 left-0 z-20 flex items-center gap-2 rounded-2xl border border-brand-line bg-white px-3.5 py-2.5 text-[13px] font-semibold shadow-[var(--shadow-hover)] sm:-left-8"
                style={{ animationDelay: "2.4s" }}
              >
                <MessageCircle size={16} className="text-brand-blue" /> Neue Nachricht
              </div>
              <div
                className="tr-schweben absolute bottom-8 right-0 z-20 hidden items-center gap-2 rounded-2xl border border-brand-line bg-white px-3.5 py-2.5 text-[13px] font-semibold shadow-[var(--shadow-hover)] sm:flex sm:-right-4"
                style={{ animationDelay: "3.2s" }}
              >
                <Trophy size={16} className="text-brand-gold" /> Turnier am Samstag
              </div>
              <div
                className="tr-schweben absolute right-4 top-4 z-20 hidden items-center gap-2 rounded-2xl bg-brand-navy px-3.5 py-2.5 text-[13px] font-semibold text-white shadow-[var(--shadow-hover)] sm:flex"
                style={{ animationDelay: "0.6s" }}
              >
                <Bell size={16} className="text-brand-gold-light" /> 3 neue Benachrichtigungen
              </div>
            </div>
          </div>
        </section>

        {/* Emotionaler Einstieg */}
        <section className="bg-brand-navy py-16 text-white sm:py-20">
          <Einblenden className={`${BREITE} text-center`}>
            <p className="text-[26px] font-extrabold leading-tight tracking-tight sm:text-[40px]">Mehr als eine App.</p>
            <p className="mt-1 text-[20px] font-semibold text-white/75 sm:text-[26px]">Ein gemeinsamer Raum für deinen Tanzsport.</p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-[34px] font-black tracking-[0.12em] sm:text-[56px]">
              <span>TANZEN.</span>
              <span className="text-brand-gold-light">TEAM.</span>
              <span className="text-brand-red">VEREIN.</span>
            </div>
          </Einblenden>
        </section>

        {/* Was ist TanzRaum + Zielgruppen */}
        <section id="was-ist-tanzraum" className="scroll-mt-20 py-16 sm:py-24">
          <div className={BREITE}>
            <Einblenden>
              <Ueberschrift
                oben="Was ist TanzRaum?"
                titel="Eine Plattform für den ganzen Tanzsport"
                text="TanzRaum ist eine digitale Plattform für den Tanzsport und insbesondere den karnevalistischen Tanzsport. Nicht als klassische Vereinssoftware, nicht als einfacher Messenger – sondern als zentraler digitaler Raum, der Tänzer, Fans, Trainer, Betreuer und Vereine verbindet."
              />
            </Einblenden>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {ZIELGRUPPEN.map((z, i) => (
                <Einblenden key={z.titel} verzoegerung={i * 80}>
                  <article className="flex h-full flex-col gap-3 rounded-[20px] border border-brand-line bg-white p-5 shadow-[var(--shadow)] transition-all hover:-translate-y-1 hover:shadow-[var(--shadow-hover)]">
                    <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${z.farbe}`}>
                      <z.icon size={22} />
                    </span>
                    <div>
                      <h3 className="text-[13px] font-bold uppercase tracking-[0.14em] text-brand-ink-soft">{z.titel}</h3>
                      <p className="mt-1 text-[19px] font-extrabold leading-snug text-brand-ink">„{z.claim}“</p>
                    </div>
                    <ul className="mt-auto flex flex-col gap-1.5 text-[13.5px] text-brand-ink-soft">
                      {z.punkte.map((p) => (
                        <li key={p} className="flex gap-2">
                          <Check size={15} className="mt-0.5 shrink-0 text-brand-green" /> {p}
                        </li>
                      ))}
                    </ul>
                  </article>
                </Einblenden>
              ))}
            </div>
          </div>
        </section>

        {/* Funktionen */}
        <section id="funktionen" className="scroll-mt-20 bg-brand-bg py-16 sm:py-24">
          <div className={BREITE}>
            <Einblenden>
              <Ueberschrift oben="Was kann TanzRaum?" titel="Alles für Training, Team und Verein" text="Jeder sieht genau die Bereiche, die zu seiner Rolle passen." />
            </Einblenden>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {FUNKTIONEN.map((f, i) => (
                <Einblenden key={f.titel} verzoegerung={(i % 4) * 70}>
                  <article className="group h-full rounded-[20px] border border-brand-line bg-white p-5 shadow-[var(--shadow)] transition-all hover:-translate-y-1 hover:border-brand-red/30 hover:shadow-[var(--shadow-hover)]">
                    <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${f.farbe} transition-transform group-hover:scale-105`}>
                      <f.icon size={24} />
                    </span>
                    <h3 className="mt-4 flex flex-wrap items-center gap-2 text-[17px] font-extrabold text-brand-ink">
                      {f.titel}
                      {f.bald && <span className="rounded-full bg-brand-gold-wash px-2 py-0.5 text-[11px] font-bold text-brand-gold">bald</span>}
                    </h3>
                    <ul className="mt-2 flex flex-col gap-1 text-[13.5px] text-brand-ink-soft">
                      {f.punkte.map((p) => (
                        <li key={p}>{p}</li>
                      ))}
                    </ul>
                  </article>
                </Einblenden>
              ))}
            </div>
          </div>
        </section>

        {/* TanzRaum Boerse (Community-Funktion fuer alle Tarife) */}
        <section id="boerse" className="scroll-mt-20 py-16 sm:py-24">
          <div className={BREITE}>
            <Einblenden>
              <div className="relative isolate overflow-hidden rounded-[28px] bg-brand-ink px-6 py-10 text-white shadow-[var(--shadow)] sm:px-12 sm:py-14">
                <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_85%_15%,rgba(201,146,31,0.35),transparent_45%),radial-gradient(circle_at_5%_110%,rgba(225,29,46,0.5),transparent_55%)]" />
                <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
                  <div>
                    <p className="mb-2 text-[12.5px] font-bold uppercase tracking-[0.18em] text-brand-gold">TanzRaum Börse · für alle</p>
                    <h2 className="text-[28px] font-extrabold leading-tight tracking-tight sm:text-[40px]">Dein Kostüm sucht einen neuen Auftritt?</h2>
                    <p className="mt-3 max-w-xl text-[15.5px] text-white/80 sm:text-[17px]">
                      Kaufen, verkaufen, tauschen oder verschenken – direkt innerhalb der TanzRaum-Community. Kontakt über den TanzRaum-Chat, ohne
                      Telefonnummer, ohne Gebühren, auch im kostenlosen FREE-Tarif.
                    </p>
                    <div className="mt-6 flex flex-wrap gap-3">
                      {!angemeldet && (
                        <Link href="/signup" className="inline-flex min-h-12 items-center rounded-full bg-brand-red px-6 text-[15px] font-bold text-white hover:bg-brand-red-deep">
                          Kostenlos mitmachen
                        </Link>
                      )}
                      <Link href={angemeldet ? "/dashboard/boerse" : "/login?weiter=/dashboard/boerse"} className="inline-flex min-h-12 items-center rounded-full border border-white/30 px-6 text-[15px] font-semibold text-white hover:bg-white/10">
                        Zur Börse
                      </Link>
                    </div>
                  </div>
                  <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {[
                      ["👗", "Kostüme"],
                      ["👠", "Tanzschuhe"],
                      ["🎀", "Accessoires"],
                      ["🎭", "Requisiten"],
                      ["👕", "Trainingsbekleidung"],
                      ["🧳", "Zubehör"],
                    ].map(([e, t]) => (
                      <li key={t} className="flex flex-col items-center gap-1.5 rounded-2xl border border-white/10 bg-white/5 px-3 py-4 text-center backdrop-blur">
                        <span className="text-[30px]" aria-hidden>
                          {e}
                        </span>
                        <span className="text-[13.5px] font-semibold">{t}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </Einblenden>
          </div>
        </section>

        {/* Smartphone-Vorschau */}
        <section className="py-16 sm:py-24" aria-labelledby="vorschau-titel">
          <div className={BREITE}>
            <Einblenden>
              <div className="mx-auto mb-10 max-w-[720px] text-center">
                <p className="mb-2 text-[12.5px] font-bold uppercase tracking-[0.18em] text-brand-red">Einblick</p>
                <h2 id="vorschau-titel" className="text-[28px] font-extrabold leading-tight tracking-tight text-brand-ink sm:text-[38px]">
                  So fühlt sich TanzRaum an
                </h2>
                <p className="mt-3 text-[15.5px] text-brand-ink-soft sm:text-[17px]">Wische durch die Bereiche – alle Inhalte sind Beispiele.</p>
              </div>
            </Einblenden>
          </div>
          {/* Innerer Streifen mit w-max + mx-auto: zentriert, wenn Platz ist – sonst vollstaendig scrollbar */}
          <div className="snap-x snap-mandatory overflow-x-auto pb-6" tabIndex={0} aria-label="Beispielansichten der App">
            <div className="mx-auto flex w-max gap-6 px-4 sm:px-6">
              {VORSCHAU.map((v) => (
                <figure key={v.titel} className="flex snap-center flex-col items-center gap-3">
                  <Telefon titel={v.titel === "Dashboard" ? undefined : v.titel}>{v.screen}</Telefon>
                  <figcaption className="text-[14px] font-bold text-brand-ink">{v.titel}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        {/* Warum TanzRaum */}
        <section className="bg-brand-navy py-16 sm:py-24">
          <div className={BREITE}>
            <Einblenden>
              <Ueberschrift oben="Warum TanzRaum?" titel="Weniger organisieren. Mehr tanzen." hell />
            </Einblenden>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {WARUM.map((w, i) => (
                <Einblenden key={w.titel} verzoegerung={(i % 3) * 80}>
                  <article className="h-full rounded-[20px] border border-white/10 bg-white/5 p-6">
                    <p className="text-[13px] font-black uppercase tracking-[0.14em] text-brand-gold-light">{w.titel}</p>
                    <p className="mt-2 text-[15.5px] leading-relaxed text-white/85">{w.text}</p>
                  </article>
                </Einblenden>
              ))}
            </div>
          </div>
        </section>

        {/* Preise */}
        <section id="preise" className="scroll-mt-20 py-16 sm:py-24">
          <div className={BREITE}>
            <Einblenden>
              <Ueberschrift oben="Preise & Lizenzen" titel="Starte kostenlos – wachse mit deinem Verein" text="Jährlich bezahlt sparst du zwei Monatsbeiträge." />
            </Einblenden>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              {tarife.map((t, i) => (
                <Einblenden key={t.name} verzoegerung={i * 90}>
                  <article
                    className={`relative flex h-full flex-col gap-5 rounded-[22px] border bg-white p-6 shadow-[var(--shadow)] ${t.hervorgehoben ? "border-brand-red shadow-[0_24px_48px_-24px_rgba(225,29,46,0.45)]" : "border-brand-line"}`}
                  >
                    {t.hervorgehoben && (
                      <span className="absolute -top-3 left-6 rounded-full bg-brand-red px-3 py-1 text-[11.5px] font-bold uppercase tracking-wide text-white">Für Vereine</span>
                    )}
                    <div>
                      <h3 className="text-[14px] font-black tracking-[0.16em] text-brand-ink">{t.name}</h3>
                      <p className="text-[13.5px] text-brand-ink-soft">{t.untertitel}</p>
                    </div>
                    {t.preis}
                    <ul className="flex flex-col gap-2 text-[14px] text-brand-ink">
                      {t.punkte.map((p) => (
                        <li key={p} className="flex gap-2">
                          <Check size={16} className={`mt-0.5 shrink-0 ${p.startsWith("Keine") ? "text-brand-ink-faint" : "text-brand-green"}`} />
                          <span className={p.startsWith("Keine") ? "text-brand-ink-soft" : ""}>{p}</span>
                        </li>
                      ))}
                    </ul>
                    <Link href={angemeldet ? "/dashboard/tarif" : t.knopf.href} className={`mt-auto ${t.knopf.primaer ? KNOPF_PRIMAER : KNOPF_SEKUNDAER}`}>
                      {angemeldet ? "In „Mein Tarif“ ansehen" : t.knopf.text}
                    </Link>
                  </article>
                </Einblenden>
              ))}
            </div>
            <p className="mt-5 text-center text-[12.5px] text-brand-ink-soft">
              Alle Details in der{" "}
              <Link href="/lizenz" className="underline">
                Lizenzübersicht
              </Link>{" "}
              und in den{" "}
              <Link href="/nutzungsbedingungen" className="underline">
                Nutzungsbedingungen
              </Link>
              .
            </p>
          </div>
        </section>

        {/* Verein-Lizenz */}
        <section className="relative isolate overflow-hidden bg-gradient-to-br from-brand-red-deep via-brand-red to-brand-gold py-16 text-white sm:py-24">
          <div className={`${BREITE} grid grid-cols-1 items-center gap-10 lg:grid-cols-2`}>
            <Einblenden>
              <p className="mb-2 text-[12.5px] font-bold uppercase tracking-[0.18em] text-white/80">Verein-Lizenz</p>
              <h2 className="text-[30px] font-extrabold leading-tight tracking-tight sm:text-[42px]">Dein Verein. Euer TanzRaum.</h2>
              <p className="mt-4 max-w-xl text-[16px] leading-relaxed text-white/90 sm:text-[18px]">
                Die komplette Vereinsverwaltung gibt es mit der Verein-Lizenz. Und jeder Verein stellt seinen Bereich selbst zusammen: Training, Kalender,
                Chat, TeamCloud, Fahrgemeinschaften – und Turniere nur, wenn ihr sie braucht.
              </p>
              <ul className="mt-6 grid grid-cols-1 gap-2 text-[14.5px] sm:grid-cols-2">
                {["Verein registrieren", "Lizenz abschließen", "Bereiche einrichten", "Mitglieder einladen"].map((s, i) => (
                  <li key={s} className="flex items-center gap-2.5">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/20 text-[13px] font-bold">{i + 1}</span>
                    {s}
                  </li>
                ))}
              </ul>
              <Link
                href={angemeldet ? "/dashboard/tarif" : "/signup?ziel=verein"}
                className="mt-8 inline-flex min-h-12 items-center rounded-xl bg-white px-6 text-[15px] font-bold text-brand-red hover:bg-brand-red-wash"
              >
                {angemeldet ? "Vereinslizenz ansehen" : "Verein registrieren"}
              </Link>
            </Einblenden>
            <Einblenden verzoegerung={120} className="flex justify-center">
              <div className="w-full max-w-[420px] rounded-[22px] bg-white p-5 text-brand-ink shadow-2xl">
                <p className="flex items-center gap-2 text-[15px] font-bold">
                  <Layers size={18} className="text-brand-red" /> Bereiche des Vereins
                </p>
                <ul className="mt-3 divide-y divide-brand-line text-[14px]">
                  {[
                    ["Training", true],
                    ["Kalender", true],
                    ["Chat", true],
                    ["TeamCloud / Dokumente", true],
                    ["Fahrgemeinschaften", true],
                    ["Turniere", false],
                  ].map(([name, an]) => (
                    <li key={String(name)} className="flex items-center justify-between py-2.5">
                      <span>{name}</span>
                      <span className={`relative h-6 w-11 rounded-full ${an ? "bg-brand-green" : "bg-brand-line"}`} aria-label={an ? "an" : "aus"}>
                        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow ${an ? "right-0.5" : "left-0.5"}`} />
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-[12px] text-brand-ink-soft">Beispiel: Turniere ausgeschaltet – ohne dass Daten verloren gehen.</p>
              </div>
            </Einblenden>
          </div>
        </section>

        {/* App-Installation */}
        <section id="app" className="scroll-mt-20 py-16 sm:py-24">
          <div className={BREITE}>
            <Einblenden>
              <Ueberschrift
                oben="Dein TanzRaum – auch unterwegs"
                titel="TanzRaum auf deinem Smartphone"
                text="TanzRaum funktioniert direkt im Browser und lässt sich wie eine App auf Smartphone, Tablet oder Computer installieren – ohne App Store, immer aktuell, mit Push-Benachrichtigungen."
              />
            </Einblenden>
            <div className="mb-10 flex flex-col items-center gap-2 text-center">
              <AppInstallieren />
              <p className="text-[13px] text-brand-ink-soft">Kostenlos · kein App Store nötig · die App startet direkt in deinem Dashboard</p>
            </div>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {[
                {
                  titel: "iPhone & iPad",
                  farbe: "bg-brand-navy",
                  schritte: ["www.tanzraum.app in Safari öffnen.", "Teilen-Symbol öffnen.", "„Zum Home-Bildschirm“ auswählen.", "„Hinzufügen“ tippen.", "TanzRaum erscheint auf dem Startbildschirm."],
                  ablauf: ["Safari", "Teilen", "Zum Home-Bildschirm", "TanzRaum"],
                  hinweis: "Beschriftungen können je nach iOS-Version leicht abweichen.",
                },
                {
                  titel: "Android",
                  farbe: "bg-brand-green",
                  schritte: [
                    "www.tanzraum.app in Chrome öffnen.",
                    "Browser-Menü öffnen.",
                    "„App installieren“, „Zum Startbildschirm hinzufügen“ oder die entsprechende Option wählen.",
                    "Installation bestätigen.",
                    "TanzRaum erscheint auf dem Smartphone.",
                  ],
                  ablauf: ["Chrome", "App installieren", "Installieren", "TanzRaum"],
                  hinweis: "Beschriftungen können je nach Gerät und Android-Version abweichen.",
                },
              ].map((k, i) => (
                <Einblenden key={k.titel} verzoegerung={i * 100}>
                  <article className="grid h-full grid-cols-1 items-center gap-6 rounded-[22px] border border-brand-line bg-white p-6 shadow-[var(--shadow)] sm:grid-cols-[1fr_auto]">
                    <div>
                      <h3 className="flex items-center gap-2 text-[20px] font-extrabold text-brand-ink">
                        <Smartphone size={20} className="text-brand-red" /> {k.titel}
                      </h3>
                      <ol className="mt-4 flex flex-col gap-2.5 text-[14.5px] text-brand-ink">
                        {k.schritte.map((s, n) => (
                          <li key={s} className="flex gap-3">
                            <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-white ${k.farbe}`}>{n + 1}</span>
                            {s}
                          </li>
                        ))}
                      </ol>
                      <p className="mt-4 text-[12.5px] text-brand-ink-soft">{k.hinweis}</p>
                    </div>
                    <div className="hidden scale-90 sm:block">
                      <Telefon>
                        <InstallScreen schritte={k.ablauf} farbe={k.farbe} />
                      </Telefon>
                    </div>
                  </article>
                </Einblenden>
              ))}
            </div>
            <div className="mt-8 hidden items-center justify-center gap-5 rounded-[22px] border border-dashed border-brand-line p-5 lg:flex">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/tanzraum-qr.svg" alt="QR-Code zu www.tanzraum.app" width={120} height={120} className="h-[120px] w-[120px]" />
              <div>
                <p className="text-[17px] font-bold text-brand-ink">Mit dem Smartphone scannen und direkt loslegen.</p>
                <p className="text-[14px] text-brand-ink-soft">www.tanzraum.app</p>
              </div>
            </div>
          </div>
        </section>

        {/* Datenschutz */}
        <section className="bg-brand-bg py-16 sm:py-24">
          <div className={BREITE}>
            <Einblenden>
              <Ueberschrift
                oben="Datenschutz im Mittelpunkt"
                titel="Deine Daten. Deine Kontrolle."
                text="TanzRaum wurde mit besonderem Fokus auf Datenschutz und den verantwortungsvollen Umgang mit personenbezogenen Daten entwickelt."
              />
            </Einblenden>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {DATENSCHUTZ.map((d, i) => (
                <Einblenden key={d.titel} verzoegerung={i * 80}>
                  <article className="h-full rounded-[20px] border border-brand-line bg-white p-5 shadow-[var(--shadow)]">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-navy text-white">
                      <d.icon size={20} />
                    </span>
                    <h3 className="mt-3 text-[16px] font-extrabold text-brand-ink">{d.titel}</h3>
                    <p className="mt-1.5 text-[13.5px] leading-relaxed text-brand-ink-soft">{d.text}</p>
                  </article>
                </Einblenden>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="scroll-mt-20 py-16 sm:py-24">
          <div className="mx-auto w-full max-w-[860px] px-4 sm:px-6">
            <Einblenden>
              <Ueberschrift oben="FAQ" titel="Häufige Fragen" />
            </Einblenden>
            <div className="flex flex-col gap-2.5">
              {FAQ.map((f) => (
                <details key={f.frage} className="group rounded-2xl border border-brand-line bg-white px-5 shadow-[var(--shadow)] open:border-brand-red/30">
                  <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 py-3 text-[15.5px] font-bold text-brand-ink [&::-webkit-details-marker]:hidden">
                    {f.frage}
                    <ChevronDown size={18} className="shrink-0 text-brand-ink-soft transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="pb-4 text-[14.5px] leading-relaxed text-brand-ink-soft">{f.antwort}</div>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Abschluss */}
        <section className="px-4 pb-16 sm:px-6 sm:pb-24">
          <Einblenden className="relative mx-auto max-w-[1200px] overflow-hidden rounded-[28px] bg-brand-navy px-6 py-14 text-center text-white sm:px-12">
            <Image src="/tanzraum-taenzer-illustration.webp" alt="" width={700} height={491} className="pointer-events-none absolute -bottom-10 -right-10 hidden w-[360px] opacity-30 md:block" />
            <h2 className="text-[28px] font-extrabold tracking-tight sm:text-[40px]">Bereit für deinen nächsten Schritt?</h2>
            <p className="mt-2 text-[16px] text-white/80 sm:text-[18px]">{angemeldet ? "Dein TanzRaum wartet schon auf dich." : "Starte kostenlos mit TanzRaum."}</p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Link href={angemeldet ? "/dashboard" : "/signup"} className={KNOPF_PRIMAER}>
                {angemeldet ? "Zum Dashboard" : "Kostenlos registrieren"}
              </Link>
              <a href="#preise" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/30 px-6 text-[15px] font-bold text-white hover:bg-white/10">
                Verein-Lizenz entdecken
              </a>
            </div>
          </Einblenden>
        </section>
      </main>

      {/* Fusszeile */}
      <footer className="border-t border-brand-line bg-white">
        <div className={`${BREITE} grid grid-cols-2 gap-8 py-12 sm:grid-cols-4`}>
          <div className="col-span-2 sm:col-span-1">
            <Image src="/tanzraum-logo-mark.webp" alt="TanzRaum" width={1254} height={1254} className="h-16 w-16" />
            <p className="mt-3 text-[13px] text-brand-ink-soft">Dein digitaler Raum für Tanzsport.</p>
          </div>
          <nav aria-label="TanzRaum">
            <p className="text-[12px] font-black uppercase tracking-[0.16em] text-brand-ink">TanzRaum</p>
            <ul className="mt-3 flex flex-col gap-2 text-[14px] text-brand-ink-soft">
              <li>
                <a href="#was-ist-tanzraum" className="hover:text-brand-ink">
                  Über TanzRaum
                </a>
              </li>
              <li>
                <a href="#funktionen" className="hover:text-brand-ink">
                  Funktionen
                </a>
              </li>
              <li>
                <a href="#preise" className="hover:text-brand-ink">
                  Preise
                </a>
              </li>
              <li>
                <a href="#faq" className="hover:text-brand-ink">
                  FAQ
                </a>
              </li>
            </ul>
          </nav>
          <nav aria-label="Rechtliches">
            <p className="text-[12px] font-black uppercase tracking-[0.16em] text-brand-ink">Rechtliches</p>
            <ul className="mt-3 flex flex-col gap-2 text-[14px] text-brand-ink-soft">
              <li>
                <Link href="/impressum" className="hover:text-brand-ink">
                  Impressum
                </Link>
              </li>
              <li>
                <Link href="/datenschutz" className="hover:text-brand-ink">
                  Datenschutz
                </Link>
              </li>
              <li>
                <Link href="/nutzungsbedingungen" className="hover:text-brand-ink">
                  Nutzungsbedingungen
                </Link>
              </li>
              <li>
                <Link href="/kontakt" className="hover:text-brand-ink">
                  Kontakt
                </Link>
              </li>
            </ul>
          </nav>
          <nav aria-label="Account">
            <p className="text-[12px] font-black uppercase tracking-[0.16em] text-brand-ink">Account</p>
            <ul className="mt-3 flex flex-col gap-2 text-[14px] text-brand-ink-soft">
              {angemeldet ? (
                <li>
                  <Link href="/dashboard" className="hover:text-brand-ink">
                    Zum Dashboard
                  </Link>
                </li>
              ) : (
                <>
                  <li>
                    <Link href="/login" className="hover:text-brand-ink">
                      Anmelden
                    </Link>
                  </li>
                  <li>
                    <Link href="/signup" className="hover:text-brand-ink">
                      Registrieren
                    </Link>
                  </li>
                </>
              )}
            </ul>
          </nav>
        </div>
        <div className="border-t border-brand-line">
          <div className={`${BREITE} flex flex-col items-center gap-1 py-6 text-center`}>
            <p className="text-[14px] font-semibold text-brand-ink">TanzRaum ist ein Projekt der Taktmanufaktur.</p>
            <p className="text-[12px] text-brand-ink-faint">© {new Date().getFullYear()} TanzRaum · Cookies nur, soweit technisch notwendig – kein Tracking</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
