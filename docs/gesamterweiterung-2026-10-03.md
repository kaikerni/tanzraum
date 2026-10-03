# Gesamt-Erweiterung 03.10.2026

Inhalt: kostenlose Admin-Freischaltung (BASIC/VEREIN) per E-Mail-Einladung, Vereinswechsel nur mit Zustimmung der Person, administrativer Vereinswechsel, Hinweis beim CSV-Import und TanzRaum-Smileys direkt im Text.

## 1. Bestandsanalyse (vor der Umsetzung)

A = vollständig vorhanden · B = teilweise vorhanden · C = fehlte

| # | Bereich | Stand vorher | Umsetzung |
|---|---|---|---|
| 1 | kostenlose BASIC-Freischaltung | B – `admin_freischaltung_*` (MANUAL_FREE) für **vorhandene** Konten, ohne Einladung | erweitert: Einladung per E-Mail, aktiv erst nach Annahme |
| 2 | kostenlose VEREIN-Freischaltung | C – VEREIN gab es nur als Vereinslizenz (`abos` inhaber=verein) | ergänzt: persönlicher VEREIN-Zugang (`abos` inhaber=person, tarif=verein, nur `manuell`+`manual_free`) |
| 3 | befristete Freischaltung | A – `abos.laeuft_bis` + nächtlicher Ablauf | wiederverwendet |
| 4 | unbefristete Freischaltung | A | wiederverwendet |
| 5 | E-Mail-Einladung | B – `send-beitritt-einladung` + Brevo-Versand, Rate-Limit | erweitert um `freischaltung_id`, neue Vorlage |
| 6 | Einladungsannahme | B – Token-Annahme für Vereinseinladungen (`/einladung/[token]`) | neue Seite `/freischaltung/[token]` nach gleichem Muster |
| 7 | bestehender Nutzer | A – Anmeldung mit `weiter`-Ziel | wiederverwendet |
| 8 | Nutzer ohne Verein | A – `invite_einloesen` / `verein_person_hinzufuegen` | unverändert |
| 9 | Nutzer mit anderem Verein | B – Freigabe nur durch bisherigen Verein, **ohne** Zustimmung der Person | ergänzt: Zustimmung der Person ist Pflicht |
| 10 | normaler Vereinswechsel | B – `vereinswechsel_anfragen` + `freigabe_entscheiden` | erweitert (Zustimmung, Status), Ausführung in gemeinsamer Funktion |
| 11 | administrativer Vereinswechsel | C | ergänzt (nur TanzRaum-Admin, Grund, Protokoll) |
| 12 | CSV-/Excel-Import | A – `MitgliederImport` + `mitglieder_import` | unverändert, nur Hinweis ergänzt |
| 13 | Erkennung vorhandener Nutzer | B – Dubletten im eigenen Verein | ergänzt: `mitglieder_import_konto_hinweise` (Konto vorhanden / anderer Verein, neutral) |
| 14 | Rollen | A – `ist_admin`, Vereinsadmin-Prüfungen | wiederverwendet |
| 15 | Tariflogik | A – `tarif_neu_berechnen_person` | erweitert: persönlicher VEREIN-Zugang ergibt Tarif `verein` |
| 16 | RLS | A | neue Tabelle mit RLS ohne Policies (nur über Funktionen) |
| 17 | Serverberechtigungen | A – SECURITY-DEFINER-Funktionen mit Rollenprüfung | alle neuen Funktionen prüfen serverseitig |
| 18 | Custom-Smilies | A – `public/sticker`, `src/lib/chat/sticker.ts` | wiederverwendet (keine Kopien, keine Emojis als Ersatz) |
| 19 | Smilie-Picker | A – `SmileyAuswahl` (TanzRaum/Smileys) | wiederverwendet; TanzRaum-Smiley wird jetzt in den Text eingefügt |
| 20 | Gruppenchats | A | gleiche `ChatFenster`-Komponente → Smileys im Text automatisch |
| 21 | Vereinschat | A | dito |
| 22 | 1:1-Chat | A | dito |

## 2. Wiederverwendete Funktionen

- `abos`-Tabelle, `admin_freischaltung_beenden`, nächtlicher Lizenzablauf, `lizenz_ablauf_hinweise_senden` (Text auf Tarifnamen angepasst)
- `tarif_neu_berechnen_person`, `protokollieren` (Audit), `benachrichtigungen`
- `send-beitritt-einladung` (Brevo, Rate-Limit, `_shared/mail.ts`, `_shared/vorlagen.ts`)
- `vereinswechsel_anfragen`, `freigabe_anfragen`, `freigabe_entscheiden`, `invite_einloesen`, `verein_person_hinzufuegen`, `vereinsbeitritt_vorbereiten` – der Ablauf von Austritt/Beitritt wurde unverändert in `vereinswechsel_vollziehen` übernommen und wird von normalem und administrativem Wechsel gemeinsam genutzt
- `MitgliederImport` / `importPruefen`
- Sticker-Assets, `SmileyAuswahl`, `ChatFenster`, Schutzprüfung (`chat-senden`)

## 3. Datenbank (Migration `20261003090000_freischaltung_einladung_vereinswechsel.sql`)

**Geänderte Bereiche**
- `abos_check`: erlaubt zusätzlich `person + verein`, nur mit `anbieter='manuell'` und `freischaltung='manual_free'` (also nie über Zahlungsanbieter oder Vereinsadmin)
- `tarif_neu_berechnen_person`: gültiger persönlicher VEREIN-Zugang → Tarif `verein`
- `vereinswechsel_anfragen`: neue Spalten `art` (normal/administrativ), `abgeschlossen_am`, `admin_id`, `admin_grund`, `quell_verein_abgelehnt_at`
- `verein_person_hinzufuegen`: Person in anderem Verein → Status `zustimmung_angefragt` (statt sofortiger Freigabe-Anfrage)
- `invite_einloesen(token, wechsel_bestaetigt)`: neue Überladung; `invite_einloesen(token)` bleibt erhalten
- `freigabe_anfragen`: zusätzliche Spalte `stand`; der bisherige Verein sieht Anfragen erst nach Zustimmung der Person, der neue Verein sieht den Namen des bisherigen Vereins nicht
- `freigabe_entscheiden`: nur nach Zustimmung; Ablehnung wird vermerkt und der Person mitgeteilt

**Neue Tabelle:** `freischaltung_einladungen` – RLS aktiv, keine Policies, keine Rechte für `anon`/`authenticated` (Zugriff nur über die Funktionen).

**Neue Funktionen**
- `admin_freischaltung_einladen`, `admin_freischaltung_einladungen`, `admin_freischaltung_gesendet`, `admin_freischaltung_einladung_widerrufen`, `mail_freischaltung_daten` – nur TanzRaum-Admin
- `freischaltung_einladung_vorschau` (anonym, E-Mail maskiert), `freischaltung_einladung_annehmen` (angemeldet, gleiche bestätigte E-Mail, einmalig)
- `vereinswechsel_vollziehen` (intern, für `authenticated` gesperrt), `vereinswechsel_anfragen_anlegen` (intern)
- `einladung_wechsel_noetig`, `meine_vereinswechsel`, `vereinswechsel_bestaetigen` – nur die Person selbst
- `admin_vereinswechsel_liste`, `admin_vereinswechsel_durchfuehren` – nur TanzRaum-Admin, nur mit Zustimmung der Person, Grund Pflicht, Protokoll `vereinswechsel_administrativ`
- `mitglieder_import_konto_hinweise` – nur Vereinsadmin des eigenen Vereins

**RLS:** Bestehende Policies wurden nicht geändert. Die neue Tabelle ist vollständig gesperrt.

**Produktionsdaten:** Die Migration ändert keine vorhandenen Datensätze. Neue Spalten sind nullable bzw. haben Standardwerte.

## 4. Edge Functions

- `send-beitritt-einladung`: neuer Zweig `{ freischaltung_id }` (Admin-Prüfung in der DB, Rate-Limit 5 je Einladung in 24 h)
- `chat-senden`: über `_shared/schutzpruefung.ts` – Smiley-Codes werden vor der Prüfung entfernt; geprüft wird zusätzlich mit Leerzeichen statt Code, das strengere Ergebnis gilt. So kann ein Code kein Wort „zerteilen“. Externe KI bleibt aus.

## 5. App (geänderte/neue Dateien)

**Neu**
- `src/components/admin/FreischaltungEinladungen.tsx`
- `src/app/freischaltung/[token]/` (Seite, Annahme, Action)
- `src/components/verein/VereinswechselHinweis.tsx`
- `src/components/admin/VereinswechselAdmin.tsx`
- `src/lib/chat/inlineSmileys.ts`
- `src/components/chat/TextMitSmileys.tsx`

**Geändert**
- `src/app/dashboard/admin/lizenzen/{actions.ts,page.tsx}`
- `src/app/dashboard/admin/vereine/{actions.ts,page.tsx}`
- `src/app/dashboard/layout.tsx`
- `src/app/dashboard/verein/actions.ts`
- `src/app/einladung/[token]/{page.tsx,EinladungAnnehmen.tsx}`
- `src/app/dashboard/mitgliedsantraege/{actions.ts,page.tsx}`
- `src/lib/antraege/getAntraege.ts`
- `src/app/dashboard/mitglieder/actions.ts`
- `src/components/mitglieder/MitgliederImport.tsx`
- `src/components/chat/{ChatFenster.tsx,ChatRahmen.tsx}`
- `src/lib/supabase/middleware.ts` (`/freischaltung` öffentlich)
- `supabase/functions/_shared/{schutzpruefung.ts,schutzpruefung_test.ts,vorlagen.ts}`
- `supabase/functions/send-beitritt-einladung/index.ts`

**API-Änderungen:** `freigabe_anfragen` liefert eine zusätzliche Spalte (abwärtskompatibel). `invite_einloesen` hat eine zusätzliche Überladung. Alle anderen Schnittstellen sind unverändert.

## 6. Smileys im Text

- Ein TanzRaum-Smiley wird als Code `:t01:` in den Text eingefügt (Picker oder Tastatur). Mehrere Smileys und Text + Smileys sind möglich.
- Ein einzelner Smiley ohne Text wird wie bisher als großer Sticker gesendet.
- Bis zu 3 Smileys ohne Text werden groß angezeigt.
- Unbekannte Codes bleiben normaler Text.
- Über dem Eingabefeld erscheint eine Vorschau.
- Die Chatliste zeigt `[Name]` statt des Codes.

## 7. Tests

- SQL `supabase/tests/freischaltung_vereinswechsel_test.sql`:
  - F1–F19 (Freischaltung)
  - W1–W29 (Wechsel, Datenschutz, Tarif, Protokoll, Sperren)
  - I1–I2 (Import)
  - Alle Ergebnisse wie erwartet.
- Übrige SQL-Tests ohne Fehler. Ausnahme: `pilotverein_test` scheitert bereits vor dieser Änderung (Rechtefehler im Test, nicht in der App).
- Schutzprüfung: 65 Regeltests bestanden, davon 4 neue zu Smiley-Codes.
- E2E im Browser:
  - Chat: Smileys im Text, mehrere, Text + Smileys, einzelner Smiley als Sticker, Umgehung per Code blockiert, Picker mobil 320/390 ohne Querscroll
  - Admin-Einladung: Formular, Liste, Widerrufen
  - Annahmeseite
  - Einladungsseite mit Wechselhinweis
  - Dashboard-Karte (360 px)
  - Admin-Wechsel: Warnung und Pflichtgrund
- TypeScript: ohne Fehler
- Build: erfolgreich
- Lint: im Projekt ist kein ESLint konfiguriert, daher nicht ausgeführt.
- Keine Secrets oder API-Keys im Code.

## 8. Einspielen (Reihenfolge)

1. Migration `20261003090000_…` im Supabase SQL Editor ausführen. Sie enthält `drop constraint`/`drop function`, deshalb geht das nicht automatisch.
2. Danach prüfen und registrieren; Edge Functions `send-beitritt-einladung` und `chat-senden` deployen.
3. Erst dann die ISO einspielen.
