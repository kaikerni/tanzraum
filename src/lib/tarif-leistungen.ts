// Was die Tarife enthalten – Anzeige auf "Mein Tarif". An der Navigation ausgerichtet (src/lib/navigation.ts):
// FREE = tarif "free", BASIC = tarif "basic", VEREIN = tarif "verein". "bald" = Bereich noch in Arbeit.
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
    { text: "Trainingszeiten im Überblick" },
    { text: "TeamCloud: 100 MB eigener Speicher für Dokumente & Musik" },
    { text: "Nachrichten im ganzen TanzRaum-Netzwerk" },
    { text: "Eigene Musik: 200 MB, im Browser abspielen" },
  ],
  verein: [
    { text: "Alles aus BASIC – für alle Mitglieder deines Vereins" },
    { text: "Unbegrenzt viele Mitglieder" },
    { text: "Mitgliederverwaltung mit Rollen & Rechten" },
    { text: "Digitale Mitgliedsanträge mit Unterschrift & PDF" },
    { text: "Tanzgruppen, Training & Anwesenheit" },
    { text: "Vereinskalender & Saisonplanung" },
    { text: "News & Umfragen, Vereinschat" },
    { text: "TeamCloud: 500 MB Vereinsspeicher" },
    { text: "Turniere & Starterlisten (abschaltbar)" },
    { text: "Trainer-Netzwerk & Vereinsstatistiken" },
    { text: "Bereiche und Zugriffe selbst einstellen" },
    { text: "Support & Fernwartung" },
    { text: "Fahrgemeinschaften für alle Mitglieder" },
    { text: "Kostüme & Requisiten: Inventar, Ausgabe, Rückgabe" },
    { text: "Finanzen: Kassenbuch mit Belegen, Mitgliedsbeiträge" },
    { text: "Musik für Training und Auftritte (1 GB)" },
  ],
};
