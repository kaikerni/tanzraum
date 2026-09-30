# Musik

Menüpunkt „Musik“ (ab BASIC; Modul `musik`, vom Verein abschaltbar). Migrationen `20260930053721_musik`,
`20260930075130_musik_schalter`.

**Plattform-Schalter:** Die TanzRaum-Administration schaltet den Musikbereich unter Administration → „Musikbereich“ für
alle ein oder aus (`plattform_einstellungen.musik_aktiv`, Standard **aus**; `admin_musik_setzen`, `musik_freigegeben`).
Aus = kein Menüpunkt, keine Schnellaktion, Hinweisseite statt Musik, keine Uploads (DB), keine Wiedergabe (RLS/Speicher).
Gespeicherte Titel und Dateien bleiben erhalten.

## Wo liegt die Musik?

Im privaten Supabase-Speicher-Bucket **`musik`** (nicht öffentlich, nicht auf dem Web-Server):
`verein/<verein_id>/<titel_id>.<endung>` bzw. `user/<user_id>/<titel_id>.<endung>`. Abspielen nur über signierte
Links (1 Stunde gültig). Metadaten in der Tabelle `musik_titel`.

## Wer darf was

- **Vereinsmusik** (Vereinslizenz): Vereinsadmin und Trainer laden hoch, bearbeiten, ordnen Gruppen zu und löschen
  (`darf_musik_verwalten`). Hören dürfen die Mitglieder der zugeordneten Gruppen und deren verknüpfte Eltern; ohne Gruppe
  der ganze Verein (`musik_hoerbar`).
- **Meine Musik** (ab BASIC): nur für die Person selbst.
- **TanzRaum-Administration: kein Zugriff.**

## Grenzen

- Pro Datei 30 MB; Formate MP3, M4A/AAC, WAV, OGG, FLAC, WebM-Audio (Bucket-Einschränkung).
- Speicher: Verein 1 GB, persönlich 200 MB (`musik_limit`), Anzeige des Belegten auf der Seite.
- Upload in drei Schritten wie die TeamCloud: `musik_upload_vorbereiten` (Rechte, Größe, Speicher, Pfad reservieren) →
  Browser lädt direkt auf den reservierten Pfad → `musik_upload_abschliessen` (prüft tatsächliche Größe/Typ).
- Ändern nur der beschreibenden Spalten (Titel, Interpret, Verwendung, Gruppen, BPM, Notiz); Pfad/Größe sind geschützt.
- Datenexport enthält die eigene Musik (Metadaten).
- Bekannt: Beim Löschen eines ganzen Kontos bzw. Vereins bleiben die Dateien im Speicher liegen, bis sie aufgeräumt werden
  (wie bei der TeamCloud).
