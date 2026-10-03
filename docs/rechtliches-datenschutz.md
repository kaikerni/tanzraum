# Rechtliches, Einwilligungen, Datenexport und Kontolöschung

## Zentrale Anbieterangaben

- Tabelle `plattform_anbieter` (genau eine Zeile): Name, Unternehmen, Anschrift, Telefon, E-Mail, Verantwortlicher nach
  § 18 MStV, Kleinunternehmer + Hinweistext, USt-IdNr., Steuernummer (nicht öffentlich).
- Pflege: Administration → Anbieterangaben (nur Plattform-Admins, RLS).
- Öffentlich lesbar nur über `plattform_anbieter_oeffentlich()` (ohne Steuernummer), im Frontend `getAnbieter()`
  (`src/lib/recht/anbieter.ts`).
- Verwendet von: Impressum, Datenschutz (Verantwortlicher), Nutzungsbedingungen (Anbieter, Widerruf, Preisangaben),
  Kontakt, Lizenzen, Rechnungsversand (`rechnung-versenden`: Rechnungssteller, Steuernummer, Kleinunternehmer-Hinweis).
- `rechnungs_einstellungen` enthält nur noch die Rechnungsnummern; `firmenzeile`/`adresse`/`steuernummer` sind veraltet.
- Sind die Angaben nicht abrufbar, zeigen die Seiten einen Hinweis – keine erfundenen Ersatzdaten.

## Rechtliche Seiten und Footer

`/impressum`, `/datenschutz`, `/nutzungsbedingungen` (inkl. `#widerruf`), `/lizenz`, `/kontakt` – öffentlich.
Einheitlicher Footer (`Fusszeile`, `RechtsLinks`) im angemeldeten Bereich unter jeder Seite (auch mobil; im Messenger
ausgeblendet, dort über Einstellungen/Hilfe erreichbar) sowie auf Login, Registrierung und Elternseiten.
Kein Kontaktformular (kein Mail-Relay). Cookies nur technisch notwendig (Anmeldung), lokaler Speicher nur für
Anzeigeeinstellungen; kein Tracking.

## Rechtstext-Versionen und Einwilligungen

- Aktuelle Fassungen: `src/lib/recht/versionen.ts` (`RECHTSTEXT_VERSION`) und Register `rechtstext_versionen` in der Datenbank.
  Neue Fassung: Text ändern, Version im Code erhöhen und per Migration in `rechtstext_versionen` eintragen. Danach müssen
  alle Konten die neuen Nutzungsbedingungen einmalig bestätigen (`/rechtstexte`).
- `einwilligungen` (append-only, Änderungen per Trigger gesperrt): wer (`user_id`), was (`art`), welche Fassung (`version`),
  zugestimmt/widerrufen (`erteilt`), wann (`zeitpunkt`), wie (`quelle`), durch wen (`erteilt_von`, z. B. Elternteil).
- Erfasst bei: Registrierung (Checkbox; Fassungen werden mitgesendet und in der Datenbank geprüft), Nachholen für
  Bestandskonten (`rechtstexte_bestaetigen`), Push (Gerät an/aus, nur Zustandswechsel), TanzRaum Map (an/aus),
  Elternzustimmung per Link (inkl. Push-Einwilligung), Eltern-Einstellungen für Kinder unter 16 (Push, Map) und
  Kauf eines Tarifs (vorzeitiger Leistungsbeginn, siehe `docs/tarife-und-zahlungen.md`).
- Einstellungen → Datenschutz zeigt den eigenen Verlauf.

## Push-Kategorien

`push_einstellungen` (je Nutzer und Kategorie). Voreinstellung an: Chat, Anrufe, Trainingsänderungen, wichtige News;
aus: Training, Abmeldung, News, Turniere. `chat_push_ziele` und `anruf_push_ziele` berücksichtigen die Kategorien.
Für Training, Abmeldung, News und Turniere gibt es noch keinen Push-Versand; die Schalter wirken, sobald diese
Benachrichtigungen gebaut sind.

## Datenexport

Einstellungen → Datenschutz → „Datenexport herunterladen“ (`/dashboard/einstellungen/export`, JSON) über
`meine_daten_export()`: Konto, Profil, eigene gesendete Nachrichten, eigene Rechnungen, alle Tabellen mit eigener Kennung
sowie Vereinsdaten zur eigenen Mitgliedschaft. Keine Daten anderer Personen (Verweise nur als interne Kennung); technische
Geheimnisse (Token-Hashes, Push-Schlüssel, Eltern-Adresse) sind ausgenommen.

## Konto löschen

Entscheidungen des Betreibers:

- Chatnachrichten bleiben, Absender anonym („Gelöschtes Konto“).
- Löschung gesperrt, solange eine Vereinsmitgliedschaft besteht (Vereinsadmins übergeben vorher die Administration).
- 14 Tage Karenz: Konto sofort gesperrt und abgemeldet, per Mail-Link widerrufbar.

Ablauf: Einstellungen → Datenschutz → „Konto löschen“ (Passwort + „LÖSCHEN“) → `konto_loeschung_beantragen()` →
Edge Function `konto-loeschung` (`bestaetigung`) schickt den Widerrufslink (`/konto/widerruf`) → Cron `konto-loeschungen`
(täglich 03:50 UTC) ruft `konto-loeschung` (`ausfuehren`) auf: Hindernisse erneut prüfen, eigene Dateien (Spotlights,
persönliche Dateien) aus dem Speicher entfernen, `konto_endgueltig_loeschen()`. Protokolliert wird nur die Anzahl
(`konto_loeschung_protokoll`).

Hindernisse (`konto_loeschung_hindernisse`): Vereinsmitgliedschaft, aktive BASIC-Lizenz, offene Überweisung,
Plattform-Admin, JuryRaum-Einträge.

Fremdschlüssel wurden so umgestellt, dass eine Löschung Vereins-, Chat- und Rechnungsdaten weder blockiert noch mitlöscht
(`ON DELETE SET NULL` für Absender, Ersteller, Rechnungsempfänger).

## Rechnungen

- Aufbewahrung 10 Jahre ab Ende des Rechnungsjahres (`rechnungen.aufbewahren_bis`, § 147 AO).
- Während der Frist unveränderlich (Trigger `rechnung_unveraenderlich`; nur Versandstatus und Aufbewahrungssperre änderbar)
  und nicht löschbar.
- Danach anonymisiert der Cron `rechnungen-anonymisieren` (täglich 04:10 UTC) die Empfängerangaben – außer die
  Aufbewahrung ist gesperrt (Administration → Rechnungen, mit Grund).
- Administration → Rechnungen: Übersicht, Fristen, Sperre, CSV-Export aller Rechnungen.
