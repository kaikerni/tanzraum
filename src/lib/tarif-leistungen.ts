// Zentrale Quelle fuer Leistungsumfang und Tarifregeln (Startseite, „Mein Tarif“, Lizenzübersicht, Kai).
// Preise kommen aus der Datenbank (tarif_preise, siehe src/lib/tarife.ts) – hier stehen nur Texte.
// Aufgefuehrt wird nur, was in TanzRaum produktiv verfuegbar ist. "bald" = Bereich noch nicht freigeschaltet
// (wird dann als „bald“ markiert und gehoert nicht zum Leistungsumfang).
export type Leistung = { text: string; bald?: boolean };

export const TARIF_LEISTUNGEN: Record<"free" | "basic" | "verein", Leistung[]> = {
  free: [
    { text: "Dashboard mit deinen Terminen" },
    { text: "Turnierkalender, Ausschreibungen & Ergebnisse" },
    { text: "Spotlights" },
    { text: "Eigenes Profil & Einstellungen" },
    { text: "Nachrichten mit deinen Kontakten" },
    { text: "TanzRaum Börse: kaufen, verkaufen, tauschen, verschenken, suchen" },
    { text: "Freiwillige Angabe „Verein, in dem ich tanze“" },
  ],
  basic: [
    { text: "Alles aus FREE" },
    { text: "TanzRaum Connect: Karte, Suche & Profile" },
    { text: "Eigener Kalender mit Kalender-Abo fürs Handy (iCal)" },
    { text: "TeamCloud: 100 MB eigener Speicher für Dokumente & Musik" },
    { text: "Nachrichten im ganzen TanzRaum-Netzwerk" },
  ],
  verein: [
    { text: "Alles aus BASIC – für alle aktiven Mitglieder deines Vereins" },
    { text: "Unbegrenzte Anzahl aktiver Vereinsmitglieder" },
    { text: "Mitgliederverwaltung mit Rollen & Rechten" },
    { text: "Mitgliederimport aus CSV/Excel" },
    { text: "Mitglieder-Einladungen per E-Mail oder persönlichem Einladungslink" },
    { text: "Digitale Mitgliedsanträge mit Unterschrift & PDF" },
    { text: "Gruppenverwaltung mit Trainer- und Betreuerzuordnung" },
    { text: "Trainingsverwaltung mit Trainings-Abmeldungen & Anwesenheit" },
    { text: "Vereinskalender & Saisonplanung" },
    { text: "Vereinskommunikation: Vereinschat, News & Umfragen" },
    { text: "TeamCloud: 500 MB Vereinsspeicher" },
    { text: "Turniere & Starterlisten (abschaltbar)" },
    { text: "Trainer-Netzwerk für eure Trainer/innen & Vereinsstatistiken" },
    { text: "Fahrgemeinschaften für alle Mitglieder" },
    { text: "Kostüme & Requisiten: Inventar, Ausgabe, Rückgabe" },
    { text: "Finanzen: Kassenbuch mit Belegen, Mitgliedsbeiträge" },
    { text: "Ehrungen & Orden" },
    { text: "Vereinsbereich und Vereinsadmin-Funktionen: Bereiche und Zugriffe selbst einstellen" },
    { text: "Support & Fernwartung" },
  ],
};

// Kurzfassung fuer die Tarifkarten der Startseite
export const TARIF_KURZ: Record<"free" | "basic" | "verein", string[]> = {
  free: ["Persönliche TanzRaum-Funktionen", "Turnierkalender und Spotlights", "TanzRaum Börse", "Keine Vereinsverwaltung"],
  basic: ["Alles aus FREE", "TanzRaum Connect mit Karte und Suche", "Eigener Kalender und TeamCloud (100 MB)", "Keine Vereinsverwaltung"],
  verein: ["Für alle aktiven Mitglieder des Vereins", "Unbegrenzte Anzahl aktiver Mitglieder", "Komplette Vereinsverwaltung", "Mitglieder einfach übernehmen (CSV/Excel)"],
};

// „VEREIN enthält unter anderem“ – Leistungsübersicht (Startseite)
export const VEREIN_UEBERSICHT: { titel: string; text: string }[] = [
  { titel: "Unbegrenzte aktive Mitglieder", text: "Alle aktiven Mitglieder des Vereins sind abgedeckt – ohne Obergrenze." },
  { titel: "Mitgliederverwaltung", text: "Rollen, Rechte, Eltern-Verknüpfungen und digitale Mitgliedsanträge." },
  { titel: "Mitglieder einfach übernehmen", text: "Mitgliederimport aus CSV/Excel, Einladung per E-Mail oder persönlichem Einladungslink." },
  { titel: "Gruppenverwaltung", text: "Tanzgruppen mit Altersklasse, Disziplin sowie Trainer- und Betreuerzuordnung." },
  { titel: "Training", text: "Trainingszeiten, Trainings-Abmeldungen und Anwesenheit." },
  { titel: "Vereinskalender", text: "Termine und Saisonplanung für den ganzen Verein." },
  { titel: "Vereinskommunikation", text: "Vereins- und Gruppenchats, News und Umfragen." },
  { titel: "Vereinsbereich & Vereinsadmin", text: "Bereiche und Zugriffe je Rolle selbst einstellen, Support und Fernwartung." },
  { titel: "Weitere Vereinsfunktionen", text: "TeamCloud, Fahrgemeinschaften, Kostüme & Requisiten, Finanzen, Ehrungen, Statistiken und optional Turniere." },
];

// Verbindliche Tarifregeln (Wortlaut)
export const VEREINSLIZENZ_TEXT =
  "Die Vereinslizenz wird für einen Verein abgeschlossen und gilt für alle aktiven Mitglieder, die diesem Verein in TanzRaum zugeordnet sind. Die Anzahl der durch die Vereinslizenz abgedeckten aktiven Mitglieder ist nicht begrenzt.";
export const KEIN_BASIC_NOETIG_TEXT =
  "Aktive Mitglieder eines Vereins, der eine VEREIN-Lizenz besitzt, sind über diese Vereinslizenz abgedeckt und müssen keine eigene BASIC-Lizenz bezahlen.";
export const BASIC_PAUSE_TEXT =
  "Hat ein Nutzer bereits eine eigene BASIC-Lizenz und wird anschließend durch die VEREIN-Lizenz seines Vereins abgedeckt, wird seine BASIC-Lizenz automatisch pausiert. Während der Abdeckung erfolgt keine weitere Abbuchung. Nach Ende der Vereinsabdeckung läuft die bestehende BASIC-Lizenz automatisch weiter. Sie wird weder gelöscht noch muss sie neu abgeschlossen werden.";
export const ABDECKUNG_ENDE_TEXT =
  "Ist ein Mitglied dem Verein nicht mehr zugeordnet (z. B. entfernt oder deaktiviert), endet für diese Person die Abdeckung durch die Vereinslizenz. Eine vorher bestehende eigene BASIC-Lizenz läuft dann automatisch weiter.";
export const MITGLIEDERIMPORT_TEXT =
  "Importiere deine bestehende Mitgliederliste aus deiner bisherigen Vereinssoftware per CSV oder Excel. Wähle selbst aus, welche Daten übernommen werden, und lade deine Mitglieder anschließend per E-Mail oder persönlichem Einladungslink zu TanzRaum ein. Der Import erstellt kein TanzRaum-Konto – jedes Mitglied registriert sich selbst.";
