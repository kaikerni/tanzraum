# Mitgliederimport und persönliche Einladungen

Funktion der **Vereinslizenz** für jeden Verein (keine Sonderlogik für einzelne Vereine).
Ein Import erstellt **keine** TanzRaum-Konten: Jedes Mitglied registriert sich selbst über seinen persönlichen Link,
danach wird das Konto automatisch mit dem vorhandenen Vereinsmitglied verbunden.

Migrationen: `20261001010639_mitgliederimport.sql`, `20261001010843_mitglied_einladung_rolle_aus_profil.sql`
Test (Rollback): `supabase/tests/mitgliederimport_test.sql`
Edge Function: `send-beitritt-einladung` (unverändert bis auf das Versandlimit: 150 statt 30 Mails pro Stunde und Absender)

## Datenmodell (bestehende Strukturen weiterverwendet)

| Tabelle | Verwendung |
|---|---|
| `mitglieder` (bestand bereits, `user_id` optional) | Vereinsmitglieder-Stammdaten – auch ohne TanzRaum-Konto. Neu: `mitgliedsnummer`, `geschlecht`, `eintrittsdatum`, `mitgliedsstatus`, `gruppe_id`, `vereins_mitglied_id` (Verbindung zum Konto), `quelle` (manuell/import), `importiert_am` |
| `vereins_mitglieder` | Mitgliedschaft mit TanzRaum-Konto (unverändert, genau ein Verein je Person) |
| `einladungen` (bestand bereits) | Persönliche Einladung: neu `mitglied_id`, `gesendet_am`, `gesendet_anzahl`. Token = zufällige UUID, 30 Tage gültig, einmal verwendbar, widerrufbar |

Kontostatus je Mitglied: 🟢 `konto` (mit Konto verbunden) · 🟠 `eingeladen` (offene persönliche Einladung) · ⚪ `ohne`.
„Noch kein Konto“ heißt nur: nicht registriert – die Person bleibt Vereinsmitglied.

## Datenbankfunktionen (alle `security definer`, nur Vereinsadmin des eigenen Vereins, Lizenz nötig zum Schreiben)

- `mitglieder_register(verein)` – Stammdaten + Kontostatus
- `mitglieder_import_pruefen(verein, zeilen)` – nur lesen: Duplikate (1. E-Mail, 2. Mitgliedsnummer, 3. Vor-+Nachname, Geburtsdatum darf nicht widersprechen), auch gegen Mitglieder mit Konto; liefert mögliche Änderungen
- `mitglieder_importieren(verein, zeilen, gruppen, quelle)` – speichert erst nach Bestätigung; nur erlaubte Felder; vorhandene Daten werden nur mit „Änderungen übernehmen“ überschrieben; neue Gruppen nur bei ausdrücklicher Wahl (über `gruppe_speichern`, also normale Gruppenlogik)
- `mitglied_einladungen_erstellen`, `mitglied_einladung_versand` (10-Minuten-Schutz gegen Doppelversand), `mitglied_einladung_gesendet`, `mitglied_einladung_widerrufen`
- `mitglied_stammdaten_aendern`, `mitglied_stammdaten_entfernen` (nur ohne Konto)
- `invite_einloesen` erweitert: persönliche Einladung verbindet das Konto mit dem Stammdatensatz, ohne Mitgliedsantrag, Gruppe aus dem Import; Rolle Tänzerin/Tänzer (Geschlecht aus Import oder Profil). Bei Mitgliedschaft in einem anderen Verein läuft die bestehende Freigabe; nach dem Wechsel verbindet der Trigger `vereins_mitglieder_stammdaten_verbinden` automatisch.
- `einladung_vorschau` liefert zusätzlich `persoenlich` (keine Personendaten).

## Ablauf für den Vereinsadmin

1. **Mitglieder → Mitglieder importieren** (`/dashboard/mitglieder/import`)
2. Datei wählen (CSV mit `;`/`,`/Tab, UTF-8 oder Windows-1252, oder Excel `.xlsx`). Die Datei wird **nur im Browser** gelesen.
3. **Welche Daten?** Nur vorhandene Felder werden angezeigt; vorausgewählt sind nur Vorname, Nachname, E-Mail, Mitgliedsnummer, Gruppe. Datenschutzhinweis.
4. **Spalten prüfen:** Zuordnung je Spalte, „Nicht importieren“ als Standard für Unbekanntes. Erkannt werden nur eindeutige Spaltennamen.
5. **Gruppen:** gefundene Gruppen mit Anzahl; je Gruppe bestehende Gruppe / neue Gruppe / nicht zuordnen. Altersklassen-Namen (z. B. „Jugend“) werden nicht als Gruppe angelegt.
6. **Import prüfen:** Anzahl je Feld, Hinweise (ungültige E-Mails/Daten), Duplikate in der Datei, mögliche vorhandene Mitglieder mit Wahl „Vorhandenes Mitglied verwenden / Als neues Mitglied importieren“, Vorschau der Datensätze.
7. **„N Mitglieder importieren“** – erst jetzt wird gespeichert. Danach: „🎉 N Vereinsmitglieder erfolgreich importiert … noch keine neuen TanzRaum-Konten erstellt.“

Nicht ausgewählte Spalten verlassen den Browser nie. Einzelne Mitglieder ohne Konto: **Mitglied anlegen**.

## Einladen

- In der Mitgliederliste: große Statusübersicht (Vereinsmitglieder, Konten, ausstehend, ohne Konto) mit Filter, „N Mitglieder einladen“ und „Einladungslinks“.
- Je Mitglied: ✉ **Einladen** / **Erneut senden** (Bestätigungsdialog, „Es wird kein Konto automatisch erstellt“) und 🔗 **Link kopieren** (Kopieren + Teilen, z. B. WhatsApp/Signal/SMS).
- Mehrfachauswahl + „Alle auswählen“ → Sammelversand (in Paketen mit Fortschritt) oder Sammelansicht der Links („Alle Links kopieren“).
- Ohne E-Mail-Adresse: Hinweis, Link trotzdem möglich; E-Mail kann im Detail ergänzt werden.

## Persönlicher Link

`/einladung/<zufälliger Token>` – keine Personendaten in der URL. Öffnen → „Jetzt registrieren“ (normale Registrierung mit
E-Mail-Bestätigung) → zurück zur Einladung → „Einladung annehmen“ → Konto mit dem Vereinsmitglied verbunden, Status 🟢.
Ein zweites Einlösen, widerrufene oder abgelaufene Links werden abgelehnt.

## Kai, Landingpage

- Kai (Mitglieder): „💡 Du hast schon eine Mitgliederliste?“ (→ Mitglieder importieren) und „Wie lade ich Mitglieder ohne Konto zu TanzRaum ein?“
- Startseite: Abschnitt „Bereits eine Vereinssoftware?“ mit Ablauf, Kurzinfo „Mitglieder einfach übernehmen“ bei der Verein-Lizenz, zwei FAQ.
