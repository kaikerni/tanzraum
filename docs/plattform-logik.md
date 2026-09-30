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
- Plattform-Admins haben eine eigene Navigation (`ADMIN_NAV` in `src/lib/navigation.ts`): nur Plattform-Aufgaben
  (Administration, Meldungen, Statistik, Vereine, Tarife, Rechnungen, Börse-Moderation, Ankündigungen, Fernwartung,
  Ehrungskatalog, Turnierkalender, TanzRaum Connect, „Ansicht als …“, Anbieterangaben, Einstellungen). Vereins-,
  Trainings-, Musik- oder Kostümbereiche erscheinen dort nicht. Auch das Admin-Dashboard zeigt nur Plattform-Karten
  und Admin-Schnellaktionen.

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
- Zentrale Anzeige in allen Dashboards (Free/Basic/Verein, Administration, JuryRaum): `OnlineUsers`
  („🟢 N TanzRaum-Nutzer online“, anklickbar) und `DatumUhrzeit`; Administration und JuryRaum über `DashboardStatus`.
  - `online_anzahl()` – dieselbe Zahl für alle (online = aktiv in den letzten 3 Minuten, nicht gesperrt); die Anzeige
    fragt sie höchstens alle 60 s ab und nur bei sichtbarem Tab.
  - `online_liste(p_suche, p_limit)` – erst beim Öffnen: nur Opt-in, nie unter 16, nie blockiert; FREE sieht nur
    Kontakte/Vereinsbeziehungen, ab BASIC zusätzlich öffentliche Profile. Keine Sonderrechte für die Administration,
    keine Vereins- oder JuryRaum-Angaben. Profil-Link (und darüber der Chat nach den bestehenden Regeln) ab BASIC.
  - JuryRaum-Layout sendet ebenfalls den Herzschlag.

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
- **Ansicht als …** `/dashboard/admin/vorschau` – Umschalter FREE, BASIC, VEREIN · Vereinsadmin/Trainer/Betreuer/
  Tänzer/Eltern. Server-Aktion `ansichtWaehlen` (echte Datenbank, nur mit `ist_plattform_admin_aktuell`) setzt das
  httpOnly-Cookie `tr_ansicht` (8 h) und den Browser-Hinweis `tr_vorschau`. Solange die Ansicht aktiv ist, prüft
  `vorschauStatus()` (`src/lib/supabase/server.ts`) pro Anfrage gegen die echte Datenbank, dass es die Plattform-Administration
  ist; dann beantwortet `vorschauFetch` (`src/lib/admin/vorschauFetch.ts`) **alle** Datenbank-Anfragen des Servers aus dem
  erfundenen Beispielverein (`src/lib/admin/vorschauDatenbank.ts`, je Rolle passend). Nur die Anmeldung geht an Supabase.
  Schreibende Anfragen werden abgelehnt („Vorschau: Änderungen werden nicht gespeichert.“), auch im Browser (`client.ts`).
  Es werden keine echten Daten gelesen. Beenden bzw. Abmelden löscht die Cookies; die Admin-Bereiche sind in der Vorschau
  nicht erreichbar. JuryRaum und die Admin-Ansicht gibt es zusätzlich als Bild.
  Auch das Dashboard läuft in der Vorschau über den echten Code; der Beispielverein bildet dabei die Datenbankregeln
  je Rolle nach (meine_bereiche mit Standard-Zugängen, netzwerk_modus nur Trainer/in, ist_relevantes_mitglied,
  training_kalender, meine_betreuten_gruppen nur Admin/Trainer, Gruppentermine/-News nur für Empfänger,
  TeamCloud-Limits 500 MB/100 MB). Plattform-Schalter (Musik, Spotlights) werden aus der echten Datenbank übernommen.
- **Benutzer** `/dashboard/admin/benutzer` – Suche nach Name, @Name oder E-Mail (`admin_benutzer_suche`, E-Mail nur
  gekürzt). „Konto löschen“ mit Pflicht-Grund: in 14 Tagen (sofort gesperrt, hier abbrechbar) oder sofort endgültig
  (`admin_konto_loeschen` → bestehender Lösch-Ablauf `konto_loeschungen` + Edge Function `konto-loeschung`). Es gelten
  dieselben Hindernisse wie beim Selbstlöschen: Vereinsmitglieder entfernt zuerst der Verein, laufende BASIC-Lizenz und
  offene Überweisung müssen erledigt sein; TanzRaum-Admins und das eigene Konto nie. Von der Administration geplante
  Löschungen haben keinen Widerrufslink. Protokoll in `admin_konto_aktionen` (Name, Aktion, Grund, Zeit).
  Beim endgültigen Löschen werden auch Börsen-Bilder und persönliche Musik entfernt.
- **Chat:** Der Admin nutzt den normalen Chat; Direktchats mit ihm tragen die Marke „TanzRaum Admin“ (`chat_liste`).
  Kein Zugriff auf Vereinschats ohne Mitgliedschaft.
- Die Tarif-/Rechnungsübersichten bleiben (Abrechnung der eigenen Kunden).

## Suche (Kopfzeile)

`/dashboard/suche?q=` (`src/lib/suche.ts`): Bereiche (sichtbare Navigation), Mitglieder (nur Vereine mit Recht auf die
Mitgliederliste), Termine, Nachrichten (Chat-Namen), Dateien, News, Turniere, Börse, Connect (ab BASIC); für die
Administration zusätzlich der Sprung in die Benutzersuche. Jede Quelle läuft mit den Rechten der Person.
Strg/Cmd + K springt ins Suchfeld, auf dem Handy führt die Lupe zur Suchseite.

## Speicher aufräumen

Edge Function `speicher-aufraeumen` (Cron 04:20 UTC, Geheimnis `chat_push_geheimnis`): `verwaiste_dateien()` liefert
Dateien älter als 2 Tage, die keine Zeile mehr verwendet (vereins-dateien, boerse, kassenbuch-belege, musik, spotlights,
ehrungs-dokumente, kostueme); gelöscht wird über die Storage-API, höchstens 500 je Lauf. Chat-Anhänge bleiben unberührt.

## TanzRaum KI

Vollständig entfernt: Komponente, Datenschutzabschnitt, Edge Function `tanzraum-assistent` und Secret
`GEMINI_API_KEY` (beides am 29.09.2026 im Supabase-Dashboard gelöscht).

## Startseite `/`

- Startseite immer sichtbar (`src/components/start/*`); angemeldet stehen statt „Anmelden/Registrieren“ „Zum Dashboard“,
  Preis-/Börsen-/Vereinsknöpfe führen ins Dashboard. Die installierte App startet weiter direkt im Dashboard
  (`manifest.webmanifest` → `start_url`).
- „App installieren“ (`AppInstallieren.tsx`): Android/Chrome/Edge öffnen den Installationsdialog des Browsers
  (`beforeinstallprompt`), iPhone/iPad zeigen die Schritte „Teilen → Zum Home-Bildschirm“, bereits installiert →
  Hinweis. Kein App Store nötig (PWA).
  `/`, `/robots.txt`, `/sitemap.xml` sind in der Middleware öffentlich.
- Preise aus `tarif_preise` (`getPreise`), Jahrespreis mit „x Monate gratis“ berechnet.
- Nur Demo-Inhalte, keine Tracker, Animationen mit `prefers-reduced-motion`.
- QR-Code als statische Datei `public/tanzraum-qr.svg` (www.tanzraum.app), nur auf großen Bildschirmen.
- SEO: Titel, Beschreibung, Open Graph/Twitter mit `public/og-tanzraum.jpg`, `metadataBase` https://tanzraum.app.
- Keine Behauptung einer App-Store-App; Installation als Web-App (PWA, `/sw.js`) für iPhone/iPad und Android erklärt.
- **Offen:** Taktmanufaktur-Logo liegt nicht im Projekt – im Footer steht der Text „TanzRaum ist ein Projekt der
  Taktmanufaktur.“ Logo-Datei nachreichen, dann einbauen.

## TeamCloud (Dateien)

Migration `20260929162131_teamcloud`.
- 500 MB je Verein, 100 MB eigene Dateien (ab BASIC), max. 50 MB je Datei (`teamcloud_limit`, Bucket-Limit).
- Hochladen/Löschen im Verein: Vereinsadmin und Trainer (`darf_teamcloud`); ansehen/herunterladen: aufgenommene
  Mitglieder (`sieht_teamcloud`). Bereich „dateien“ aus → nicht sichtbar.
- Upload in drei Schritten: `teamcloud_upload_vorbereiten` (Rechte, Speicher, Platz reservieren) → Browser lädt direkt
  in `vereins-dateien` (nur auf den reservierten Pfad erlaubt) → `teamcloud_upload_abschliessen` (tatsächliche Größe
  aus dem Speicher geprüft). Abgebrochene Reservierungen geben ihren Platz nach 1 Stunde frei.
- Seite `/dashboard/dateien` (Menü „TeamCloud“): Speicheranzeige, Ordner, Musik direkt anhören, Laden, Löschen.

## Zugriff je Bereich (Vereinsadmin)

Migration `20260929162928_bereich_zugang`. Vereinsverwaltung → Bereiche → „Wer hat Zugriff?“.
Der Admin hat immer Zugriff; Einzelrechte pro Mitglied gelten zusätzlich.

| Bereich | Recht | Standard |
|---|---|---|
| Fahrgemeinschaften (nur Verein-Lizenz) | `fahrgemeinschaften` | immer alle Mitglieder (nicht einschränkbar) |
| Kostüme & Requisiten | `material` | Betreuer |
| Finanzen (nur Verein-Lizenz) | `beitraege` | nur Admin |
| Statistiken | `statistiken` | nur Admin |

Musik: ab BASIC (unverändert). Statistik-Inhalte wählt der Admin (`vereine.statistik_inhalte`: Mitgliederentwicklung,
Rollen, Altersklassen, Tanzgruppen, Trainingsbeteiligung, Turnierergebnisse); Seite `/dashboard/statistiken` zeigt nur
zusammengefasste Zahlen (`verein_statistik`).

Vereinsbereiche: siehe `docs/musik.md`, `docs/kostueme.md`, `docs/finanzen.md`, `docs/fahrgemeinschaften.md`.
