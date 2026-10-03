# Verbindliche Struktur FREE / BASIC / VEREIN – TanzRaum-Netzwerk, Buddys, Spotlight, Messenger

Stand 01.10.2026 · Migration `20261001115152_netzwerk_buddys_messenger.sql` · Test `supabase/tests/netzwerk_buddys_messenger_test.sql`

„TanzRaum Connect“ gibt es nicht mehr. Der eine soziale Bereich heißt **TanzRaum-Netzwerk**. Es gibt weiterhin genau
eine Chat-, eine Spotlight- und eine Netzwerkarchitektur – alles baut auf den bestehenden Tabellen und Funktionen auf.

## Navigation (`src/lib/navigation.ts`)

| Hauptpunkt | Unterpunkte | ab |
|---|---|---|
| 🏠 Dashboard | – | FREE |
| 🏢 Mein Verein | Mitglieder, Gruppen, Training, Anwesenheit, Kalender, Saisonplanung, News, Mitgliedsanträge, Fahrgemeinschaften, Kostüme, Finanzen, Statistiken, Vereinsverwaltung (je nach Rolle/Recht/Modul) | Vereinsbereiche ab VEREIN |
| 🌐 TanzRaum-Netzwerk | Nutzer suchen · Meine Buddys · Buddy-Anfragen · Map · Vereine | FREE: nur Nutzer suchen |
| ✨ Spotlight | eigener Story-Bereich (siehe `docs/spotlight-story-editor.md`) | ansehen FREE (Schalter), erstellen ab BASIC |
| 💬 Nachrichten | Chats · Gruppenchats | BASIC |
| 🏆 Turniere | – | FREE (Verein kann das Modul ausschalten) |
| 🧑‍⚖️ JuryRaum | – | nur wenn global eingeschaltet **und** berechtigt |

Danach unverändert: Trainer-Netzwerk, TeamCloud, Börse, Musik, Mein Tarif, Einstellungen. Die Seitenleiste zeigt
Unterpunkte eingerückt (aufgeklappt im aktiven Bereich, Pfeil zum Auf-/Zuklappen). Auf dem Handy erreicht man die
Unterpunkte von Netzwerk und Nachrichten über die Reiter des Bereichs. Ohne Vereinsmitgliedschaft stehen z. B.
Kalender als eigene Punkte in der Liste. Niemand sieht Menüpunkte ohne Berechtigung (`sichtbareNav`).

## Leistungen je Tarif

| | FREE | BASIC | VEREIN (Vereinslizenz) |
|---|---|---|---|
| Konto, Profil, Einstellungen, Privatsphäre | ✓ | ✓ | ✓ |
| Nutzer suchen, freigegebene Profile ansehen | ✓ (Name/@Nutzername) | ✓ (+ Kategorien, Ort) | ✓ |
| Direktnachricht aus dem Profil, Zustell-/Lesestatus | ✓ | ✓ | ✓ |
| Chatübersicht, Gruppenchats, voller Messenger | – | ✓ | ✓ |
| Buddys (anfragen, annehmen, ablehnen, entfernen, Liste mit Online-Status) | – | ✓ | ✓ |
| Spotlight ansehen | ✓ (wenn für FREE eingeschaltet) | ✓ | ✓ |
| Spotlight erstellen/verwalten/löschen | – | ✓ | ✓ |
| Map, Vereine entdecken | – | ✓ | ✓ |
| Vereinsbereich / Vereinsverwaltung | – | – | ✓ |

Die Vereinslizenz bleibt unverändert: aktive Mitglieder eines lizenzierten Vereins haben automatisch alles aus BASIC
(`tarif_von` = `verein`) und zahlen kein BASIC.

## Datenbank (Änderungen)

- `darf_direkt_schreiben`: neu „beide ab 16 + freigegebenes Profil“ (alle Tarife). Private Konten nur für Buddys
  (beide BASIC/VEREIN). Verein, Eltern/Kind, Blockieren, Elternsperre und unter-16-Schutz unverändert.
- `schreib_sperrgrund`: neuer Grund `privat_konto`.
- `kontakt_aufnehmen`: max. 20 neue Direktchats pro Tag ohne Verein-/Familien-/Buddy-Beziehung.
- Buddys: `kontaktanfrage_senden` (ab BASIC, unabhängig von der Nachrichtenfunktion), `kontaktanfrage_beantworten`
  (Annehmen ab BASIC), `netzwerk_person.kann_vernetzen` (ab BASIC), neu `buddy_entfernen`, `meine_buddys`.
  Bestehende Verbindungen (`connections`) bleiben unverändert erhalten.
- Gruppenchats: `gespraeche.typ` + `'gruppenchat'`; `hat_gespraech_zugriff` (Mitglied + BASIC/VEREIN),
  `ist_chat_leitung` (Ersteller/in), `chat_liste` (Bereich `gruppenchat`), neue `gruppenchat_*`-Funktionen.
- Zustellstatus: `gespraech_teilnehmer.zugestellt_bis`, `nachrichten_zugestellt()`, `chat_gelesen` setzt beides,
  `chat_kopf` liefert zusätzlich `partner_zugestellt_bis` (Gruppenchat: ältester Stand aller anderen).
- JuryRaum-Schalter: `plattform_einstellungen.juryraum_aktiv` (Standard **aus**), `juryraum_freigegeben()`,
  `juryraum_fuer_mich()`, `admin_juryraum_setzen()`; `juryraum_eigene_rolle()` liefert bei „aus“ nichts – damit sind
  JuryRaum-Turniere, -Besetzungen, -Unterkünfte, -Fahrgemeinschaften und -Chats über die bestehenden Regeln gesperrt.
  **Es werden keine JuryRaum-Daten gelöscht.**

## JuryRaum

TanzRaum-Administration → Karte „JuryRaum“ (Schalter). Aus: kein Menüpunkt, keine Dashboard-Karte, keine Kai-Themen
(Kai verlinkt nur freigegebene Bereiche), `/juryraum/*` leitet serverseitig zum Dashboard um, Daten bleiben erhalten.

## Dashboard

Kein Spotlight-Modul mehr. Dezenter Hinweis „TanzRaum-Netzwerk“ (bei neuen Spotlights mit Anzahl und Link zu
„Spotlight“). Die Karte „Nachrichten“ zeigt neue Nachrichten – für FREE der einzige Einstieg in empfangene
Direktnachrichten (ohne Chatübersicht).

## Kai

Tarifabhängige Antworten über `nurOhne` (Frage nur, solange ein Bereich nicht freigegeben ist), z. B. FREE:
„Mit FREE kannst du Nutzer suchen und einzelne Direktnachrichten senden. Buddys und der vollständige Messenger sind ab
BASIC verfügbar.“ Links nur auf Bereiche, die die Person selbst im Menü hat – Unterpunkte mit eigenem Menüeintrag
(z. B. „Meine Buddys“) müssen selbst freigegeben sein.

## Hinweis Produktion

Die Migration muss in Supabase eingespielt werden (SQL-Editor oder MCP), **bevor** die neue App-Version installiert
wird – die App ruft die neuen Funktionen (`juryraum_fuer_mich`, `meine_buddys`, `nachrichten_zugestellt` …) auf.


> Aktualisierung: Spotlight ist seit dem Story-Editor ein **eigener Hauptbereich** (`/dashboard/spotlight`). Die
> Reihenfolge der Menüpunkte kann jede Person selbst festlegen (`docs/meine-navigation.md`).
