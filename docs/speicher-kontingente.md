# Speicher & Kontingente (03.10.2026)

Zentrale, serverseitig gespeicherte Speicherverwaltung für die TanzRaum-Administration.

- Seite: **Administration → Speicher & Kontingente** (`/dashboard/admin/speicher`)
- Bearbeiten darf nur der TanzRaum-Admin.
- Änderungen gelten sofort, ohne neuen Build.

## 1. Bestandsanalyse

| Frage | Ergebnis |
|---|---|
| Wo wurden Limits definiert? | In zwei SQL-Funktionen, fest codiert: `teamcloud_limit` (500 MB je Verein, 100 MB persönlich) und `musik_limit` (1 GB je Verein, 200 MB persönlich). Zusätzlich standen dieselben Zahlen als Text in `tarif-leistungen.ts`, `MusikSchalter.tsx` und einem Kommentar der TeamCloud-Seite. |
| Storage-System | Supabase Storage (Projekt im **Free-Plan → technisch 1 GB**) |
| Buckets (16) | `vereins-dateien`, `musik`, `chat-bilder`, `chat-dateien`, `spotlights`, `boerse`, `treff`, `workshops`, `wissen`, `kostueme`, `kassenbuch-belege`, `ehrungs-dokumente`, `mitgliedsantraege`, `verein-logos`, `vereinsdokumente`, `ankuendigungen` |
| Upload-Bereiche | TeamCloud und Musik laufen über eine Reservierung (`…_upload_vorbereiten` → Upload auf den reservierten Pfad → `…_upload_abschliessen`). Alle anderen Bereiche laden direkt in den Bucket; die Speicherregeln (RLS) prüfen dort nur die Berechtigung. |
| Bisherige Kontingente | Nur TeamCloud und Musik. Die übrigen Bereiche hatten nur eine Größengrenze je Datei (Bucket-Einstellung, 5–50 MB). |
| Verbrauchsberechnung | TeamCloud aus `dateien.groesse_bytes`, Musik aus `musik_titel.groesse_bytes` (jeweils mit Reservierungen) |
| RLS | Je Bucket eigene Regeln für Lesen, Hochladen und Löschen |
| Edge Functions mit Upload-Prüfung | Keine. `mitgliedsantrag` legt PDFs mit Service-Rolle ab. |
| Settings-Tabelle | `plattform_einstellungen` (eine Zeile, Schalter der Administration) |
| Admin-Konfiguration | Schalter (Spotlights, Musik, JuryRaum, Chat) und „Navigation & Bereiche“ |
| Gefundener Fehler | `teamcloud_upload_vorbereiten` schrieb beim Hochladen ohne Unterordner `NULL` in die Pflichtspalte `dateien.ordner_pfad`. Der Upload schlug deshalb fehl. Behoben: Hauptordner ist jetzt `''`. |

## 2. Neue Struktur

Technisch verfügbarer Speicher und TanzRaum-Kontingente sind getrennt:

1. **Technisch verfügbarer Speicher**: `plattform_einstellungen.speicher_technisch_mb`. Dient nur zur Information und Warnung. Daraus wird nie etwas automatisch abgeleitet.
2. **Für TanzRaum freigegebener Gesamtspeicher**: `plattform_einstellungen.speicher_gesamt_mb`.
   - Bei 100 % sind keine neuen Uploads möglich (alle Buckets).
   - Warnstufen in der Administration: ab 80 % Hinweis, ab 90 % Warnung, ab 95 % deutliche Warnung.
3. **Kontingente je Bereich**: neue Tabelle `speicher_kontingente`, eine Zeile je Bereich mit:
   - `limit_mb`
   - `aktiv` (Uploads erlaubt)
   - `bezug` (je Person oder je Verein)
   - `buckets`
   - `pruefung` (`reservierung` = exakte Prüfung vor dem Upload, `storage` = Prüfung über die Speicherregel)

   Für einen weiteren Bereich genügt eine weitere Zeile.

**Einheit:** überall MB (1 MB = 1.024 × 1.024 Byte). Die Oberfläche zeigt zusätzlich GB an.

| Bereich | Bezug | Prüfung | Startwert |
|---|---|---|---|
| TeamCloud – Verein (VEREIN) | je Verein | Reservierung | 500 MB (wie bisher) |
| TeamCloud – persönlich (BASIC) | je Person | Reservierung | 100 MB (wie bisher) |
| Musik – Verein | je Verein | Reservierung | 1.024 MB (wie bisher) |
| Musik – persönlich (BASIC) | je Person | Reservierung | 200 MB (wie bisher) |
| Chat-Bilder & -Dateien | je Person | Speicherregel | 500 MB (neu) |
| Spotlights | je Person | Speicherregel | 500 MB (neu) |
| Börse, Treff, Workshops & Wissen | je Person | Speicherregel | 200 MB (neu) |
| Weitere Vereinsdaten (Kostüme, Belege, Ehrungen, Anträge, Logo, Satzung) | je Verein | Speicherregel | 1.024 MB (neu) |

**Gesamtspeicher:** Startwert 1.000 MB freigegeben, 1.024 MB technisch (Supabase Free).

## 3. Serverseitige Prüfung

Bei jedem Upload prüft der Server, ob der Bereich aktiv ist, ob noch Gesamtspeicher frei ist und ob das Kontingent ausreicht.

- **TeamCloud und Musik**: Die Reservierung prüft Person, Verein, Rolle, Tarif, Bereich, Kontingent, aktuelle Belegung und Dateigröße. Beim Abschließen wird die tatsächliche Größe aus dem Speicher geprüft. Hochladen kann man nur auf den reservierten Pfad.
- **Direkte Uploads**: Es gibt eine zusätzliche RESTRICTIVE-Regel „Speicher: Kontingente und Gesamtspeicher“ auf `storage.objects`. Sie gilt zusätzlich zu den bestehenden Regeln, die unverändert bleiben.
  - Neue Dateien sind nur möglich, solange der Bereich unter dem Kontingent liegt.
  - Je Person wird nach dem Eigentümer der Datei gezählt, je Verein nach der Vereins-ID im Pfad.
  - Die Größe der neuen Datei kennt die Datenbank vorher nicht. Deshalb kann höchstens eine Datei das Limit überschreiten; deren Größe begrenzt der Bucket.
  - Manipulierte Requests oder direkte API-Aufrufe umgehen die Regel nicht.
- **Vorprüfung** `speicher_vorpruefung` an allen direkten Upload-Stellen. Sie liefert die verständliche Meldung, zum Beispiel: „Speicherlimit erreicht. Du verwendest 98 MB von 100 MB. Für diese Datei werden 8 MB benötigt.“
- **Verringern**: Es wird nichts gelöscht. Wer über dem neuen Limit liegt, kann erst nach dem Entfernen von Dateien wieder hochladen. TeamCloud und Musik zeigen dazu: „Speicherlimit wurde reduziert. Aktuell verwendet … Neues Limit …“.
- **Rechte**:
  - Die Tabelle ist für `anon` und `authenticated` gesperrt.
  - Ändern geht nur über `admin_speicher_speichern`, Übersicht nur über `admin_speicher_uebersicht`; beide sind nur für den TanzRaum-Admin.
  - Vereinsadmins sehen wie bisher nur den eigenen Verbrauch (TeamCloud, Musik).
- **Protokoll**: Jede Änderung wird mit `protokollieren('speicher_geaendert')` festgehalten (Bereich, alt → neu, Uploads an/aus, ausführender Admin, Zeitpunkt).

## 4. Geänderte Dateien

- **Migration**: `supabase/migrations/20261003100000_speicher_kontingente.sql`
- **Test**: `supabase/tests/speicher_kontingente_test.sql`
- **Neu**:
  - `src/lib/speicher.ts`
  - `src/components/speicher/SpeicherReduziert.tsx`
  - `src/components/admin/SpeicherVerwaltung.tsx`
  - `src/app/dashboard/admin/speicher/{page.tsx,actions.ts}`
- **Geändert**:
  - Navigation und Startseite der Administration
  - Protokoll
  - TeamCloud- und Musik-Seite (Hinweis bei Überschreitung)
  - `tarif-leistungen.ts`, `TarifKarten.tsx`, `/lizenz`, `/dashboard/tarif` (Speichergrößen aus der Datenbank)
  - `MusikSchalter.tsx`
  - Upload-Stellen mit Vorprüfung: Chat (Bilder, Dateien, Video, Sprache), Spotlights, Börse, Treff, Workshops, Wissen, Kostüme, Belege, Ehrungen, Anträge, Vereinslogo, Ankündigungen
  - Vorschau-Daten
- **Edge Functions**: keine Änderungen
- **APIs**:
  - neu: `speicher_vorpruefung`, `speicher_kontingente_oeffentlich`, `admin_speicher_uebersicht`, `admin_speicher_speichern`
  - geändert: `teamcloud_limit` und `musik_limit` lesen jetzt zentral (gleiche Signatur, Rückfall auf die alten Werte)
  - geändert: `teamcloud_upload_vorbereiten` und `musik_upload_vorbereiten` nutzen jetzt die zentrale Prüfung
- **Buckets**: nicht umbenannt, nicht gelöscht, Grenzen je Datei unverändert. Es wurden keine Dateien und keine Nutzer- oder Vereinsdaten verändert.

## 5. Tests

**SQL** (`speicher_kontingente_test.sql`, S1–S30, alle wie erwartet):
- Vereinsadmin kann weder ändern noch die Übersicht sehen, die Tabelle ist direkt gesperrt
- Upload innerhalb des Limits funktioniert, Upload darüber wird mit verständlicher Meldung abgelehnt
- Erhöhung gilt sofort
- BASIC und VEREIN erhalten das richtige Kontingent; FREE hat keine persönliche TeamCloud
- Verringern löscht nichts und sperrt weitere Uploads
- Deaktivierte Bereiche nehmen keine Uploads an
- Musik nutzt das zentrale Kontingent
- Direkter Storage-Upload über dem Limit wird abgelehnt (RLS 42501); die Belegung anderer Personen zählt nicht mit
- Gesamtspeicher voll sperrt Reservierungen und direkte Uploads
- Protokoll mit alt/neu
- `anon` liest nur die Kontingentwerte

Alle übrigen SQL-Tests laufen ohne Fehler (`pilotverein_test` scheiterte schon vorher).

**Browser** (27 Prüfungen, bestanden):
- Navigation und Kachel
- Übersicht mit Warnstufen 80, 90, 95 und 100 %
- Technischer Speicher getrennt dargestellt
- Verbrauch nach Bereich, größte Verbraucher
- Speichern, Reload, Protokoll
- TeamCloud-Hinweis nach Reduzierung
- Tarif-, Lizenz- und Musik-Texte aus der Datenbank
- Upload-Meldung in der Börse
- Vereinsadmin ohne Zugriff, API-Aufruf ohne Admin-Recht abgelehnt
- Mobil 320 und 390 px ohne Querscrollen

TypeScript und Build sind ohne Fehler. ESLint ist im Projekt nicht eingerichtet.

## 6. Hinweis zum Speicher

Der Supabase Free-Plan hat technisch 1 GB. Die Startwerte der Vereins-Kontingente (TeamCloud 500 MB, Musik 1 GB je Verein) übersteigen das schon bei einem Verein rechnerisch. Bis Speicher dazugebucht ist, schützt der Gesamtspeicher (1.000 MB) vor dem Überlaufen. Nach dem Erweitern genügt es, in der Administration die beiden Werte anzupassen.
