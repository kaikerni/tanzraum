# Plattform-Logik: Lizenzen, Vereinsbereiche, Online-Status, Administration, Startseite

Stand: 29.09.2026 · Migrationen `20260929135109_plattform_logik`, `20260929135650_vereinschat_modul`,
`20260929135834_meine_profilangaben`, `20260929140125_antrag_formular_optionen`.

## Lizenzmodell

| Stufe | Wer | Vereinsverwaltung | Offizielle Vereinszuordnung |
|---|---|---|---|
| FREE | jede Person, kostenlos | nein | nein |
| BASIC | persönliche Lizenz (FREE + Extras) | nein | nein |
| VEREIN | Verein mit aktiver Verein-Lizenz | ja | ja, für aufgenommene Mitglieder |
| TanzRaum-Admin | Plattform-Administration | – | – |

- **Nur Vereine mit aktiver Lizenz haben offizielle Mitglieder.** Trigger `vereins_mitglieder_lizenz`
  (`pruefe_vereinslizenz_zuordnung`): In einem Verein ohne Lizenz darf nur die erste Person (der Vereinsadmin bei der
  Registrierung) eingetragen sein. Jede weitere Zuordnung wird von der Datenbank abgelehnt – egal über welchen Weg
  (Einladung, Hinzufügen, Antrag).
- **Verein registrieren:** Verein anlegen (`verein_anlegen`, man wird Vereinsadmin) → weiter zu „Mein Tarif“ →
  Verein-Lizenz abschließen (Freischaltung nur per Zahlungs-Webhook) → Vereinsdaten und Bereiche einrichten →
  Mitglieder einladen. Texte in Onboarding, „Mein Verein“ und Tarifseite entsprechend.
- **Genau ein Verein je Person** und Freigabe durch den bisherigen Verein: unverändert (siehe `mitgliedsantraege.md`).
- **„Verein, in dem ich tanze“** (`profiles.verein_angabe`, ≤ 100 Zeichen): freiwilliger Freitext in den Einstellungen,
  änderbar/löschbar, ohne Rechte und ohne Verknüpfung. Angezeigt im Profil (TanzRaum Connect) nur, wenn das Profil
  sichtbar ist und keine offizielle Zuordnung besteht. Lesen der eigenen Werte über `meine_profilangaben()`
  (die Spalten sind für `authenticated` nicht direkt lesbar).

## Konfigurierbare Vereinsbereiche

- `vereine.module_aus text[]` – ausgeschaltete Bereiche; gültige Werte liefert `vereins_module()`:
  training, anwesenheit, kalender, saisonplanung, turniere, news, chat, dateien, fahrgemeinschaften, kostueme,
  finanzen, musik, statistiken, trainer_netzwerk.
- Setzen: `verein_module_setzen(verein, text[])` (Vereinsadmin oder aktive Fernwartung, dann protokolliert).
  UI: Vereinsverwaltung → **Bereiche**.
- Wirkung (Daten werden nie gelöscht):
  - Navigation (`NavEintrag.modul`, `modulAn()` in `src/lib/navigation.ts`, Werte aus `meine_module_aus()`),
  - Schnellaktionen, Dashboard-Karten/KPIs (Turniere, Training, Anwesenheit, Kalender), Radar- und Termin-Einträge
    vom Typ Turnier/Training,
  - Seiten: `layout.tsx` mit `ModulSchutz` in training, anwesenheit, kalender, saisonplanung, turniere, news,
    trainer-netzwerk; Platzhalterseiten über `[...bereich]`,
  - Vereinschat: `hat_gespraech_zugriff` liefert für Vereinschats mit ausgeschaltetem Bereich `false`
    (unsichtbar, nicht beschreibbar; Nachrichten bleiben gespeichert).
  - Turnier-Benachrichtigungen: Es gibt derzeit keine automatischen Turnier-Pushes; sobald welche entstehen, müssen
    sie `module_aus` prüfen.
- Plattform-Admins sehen immer alles (für Support).

## Mitgliedsantrag – weitere Verfahren

- `extern`: Aufnahme über das eigene Verfahren des Vereins (Beschreibung `extern_text`, optional `extern_link`),
  keine Unterschrift in TanzRaum.
- `bestehend`: Wer schon Mitglied ist, bestätigt nur (Name, E-Mail, optional „Mitglied seit“, Häkchen).
  Einstellung `bestehende_bestaetigen` (Standard: an). Der Verein nimmt die Bestätigung wie einen Antrag an.
- Prüfung doppelt: `pruefeAntrag()` (App, gemeinsam mit PDF in `supabase/functions/_shared/antrag-vorlage.ts`) und
  `antrag_einreichen` (DB). `antrag_formular` liefert die Optionen unter `optionen`.

## Online-Status

- `online_melden()` – Herzschlag aus dem Dashboard-Layout (`OnlineHerzschlag`, ~60 s, nur bei sichtbarem Tab;
  DB drosselt auf 45 s).
- `online_uebersicht()` – Zahlen für alle (gesamt, eigener Verein) und Namen nur von Kontakten/Vereinsmitgliedern mit
  Opt-in (`online_sichtbar`), nie unter 16, nie blockierte Personen, max. 12.
- Opt-in in den Einstellungen („Online-Status“), Standard aus.

## TanzRaum-Administration (keine Personendaten)

- **Statistik** `/dashboard/admin/statistik` – `admin_plattform_statistik()` (nur Zahlen): Nutzer gesamt,
  FREE/BASIC/über Verein, mit/ohne Zuordnung, online, aktiv 24 h, Registrierungen (12 Monate), Vereine/Lizenzen,
  Gruppen, Nachrichten pro Woche. SVG-Diagramme ohne Bibliothek (`src/components/admin/Diagramme.tsx`).
- **Vereine** `/dashboard/admin/vereine` – `admin_vereinskarten()`: Name, Ort, Lizenz, Anzahl Mitglieder/Gruppen/online.
  Die bisherige Mitgliederliste je Verein ist entfernt (`admin_verein_mitglieder` u. a. gelöscht).
- **Fernwartung** – Verein: Vereinsverwaltung → Fernwartung & Support (anfragen, 24 h Fernzugriff, widerrufen,
  Protokoll). Admin: `/dashboard/admin/fernwartung` → nur bei aktiver Freigabe `fernwartung_vereinsdaten` /
  `fernwartung_vereinsdaten_setzen`, Bereiche und Antragsformular. Alles wird in `fernwartung_protokoll` vermerkt.
  Anfordern nur mit aktiver Verein-Lizenz.
- **Oberflächen-Vorschau** `/dashboard/admin/vorschau` – FREE, BASIC, VEREIN, ADMIN, JuryRaum mit erfundenen Daten
  (`src/lib/admin/vorschauDaten.ts`).
- **Chat:** Der Admin nutzt den normalen Chat; Direktchats mit ihm tragen die Marke „TanzRaum Admin“ (`chat_liste`).
  Kein Zugriff auf Vereinschats ohne Mitgliedschaft.
- Die Tarif-/Rechnungsübersichten bleiben (Abrechnung der eigenen Kunden).

## TanzRaum KI

Vollständig entfernt: Komponente, Datenschutzabschnitt, Edge Function `tanzraum-assistent` und Secret
`GEMINI_API_KEY` (beides am 29.09.2026 im Supabase-Dashboard gelöscht).

## Startseite `/`

- Nicht angemeldet: öffentliche Startseite (`src/components/start/*`), angemeldet: Weiterleitung ins Dashboard.
  `/`, `/robots.txt`, `/sitemap.xml` sind in der Middleware öffentlich.
- Preise aus `tarif_preise` (`getPreise`), Jahrespreis mit „x Monate gratis“ berechnet.
- Nur Demo-Inhalte, keine Tracker, Animationen mit `prefers-reduced-motion`.
- QR-Code als statische Datei `public/tanzraum-qr.svg` (www.tanzraum.app), nur auf großen Bildschirmen.
- SEO: Titel, Beschreibung, Open Graph/Twitter mit `public/og-tanzraum.jpg`, `metadataBase` https://tanzraum.app.
- Keine Behauptung einer App-Store-App; Installation als Web-App (PWA, `/sw.js`) für iPhone/iPad und Android erklärt.
- **Offen:** Taktmanufaktur-Logo liegt nicht im Projekt – im Footer steht der Text „TanzRaum ist ein Projekt der
  Taktmanufaktur.“ Logo-Datei nachreichen, dann einbauen.
