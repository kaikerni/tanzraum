# TanzRaum-Messenger

Der **TanzRaum-Messenger** („Nachrichten“) ist die Kommunikation innerhalb von TanzRaum. Er hat **keinen eigenen
Menüpunkt**: Chats öffnen sich über das Nachrichten-Symbol in der Kopfzeile, aus Profilen („Nachricht senden“),
Kontakten sowie Vereins- und Gruppenbeziehungen. Siehe auch `docs/soziale-struktur.md`.

Route: `/dashboard/nachrichten` · Nachrichten ab BASIC bzw. mit Vereinslizenz; FREE kann nur Kontaktanfragen senden
und annehmen.

## Funktionen

| | Funktion | Umsetzung |
|---|---|---|
| 💬 | Textnachrichten | Enter = senden, Umschalt+Enter = neue Zeile (Handy: Senden-Knopf); Antworten, Kopieren, Löschen, Links, Lesebestätigung (Privatchat) |
| ✏️ | Bearbeiten, Weiterleiten, Suchen | eigene Textnachrichten 24 h bearbeitbar („bearbeitet“); Text/Smiley/Standort weiterleiten („Weitergeleitet“); Suche im Verlauf mit Sprung; „Als ungelesen markieren“ |
| 🩰 | TanzRaum-Smileys | **ausschließlich** die eigenen TanzRaum-Smileys – keine Unicode-Emoji-Auswahl. 133 Sticker („Tanzmariechen“ 83, „Gardist“ 50), Reiter Zuletzt / Tanzmariechen / Gardist / Gefühle / Tanz & Akrobatik / Turnier & Jubel / Team & Freunde / Musik & Party / Alltag & Training. Bilder `public/sticker/`, Liste `src/lib/chat/sticker.ts`, Tabelle `sticker` (mit `kategorie`). Neue Smileys: Bild ablegen, Eintrag in beiden ergänzen |
| ❤️ | Reaktionen | nur TanzRaum-Smileys (8 Schnellreaktionen + alle über „+“); die DB lässt nur Sticker-IDs zu |
| 📸 | Bilder | bis zu 10 Fotos/Videos auf einmal mit Vorschau (je eine Nachricht); werden im Browser verkleinert, privater Bucket `chat-bilder` (5 MB) |
| 🎥 | Videos | werden im Browser verkleinert und direkt im Chat abgespielt, privater Bucket `chat-dateien` (25 MB) |
| 📎 | Dateien | PDF, Office, OpenDocument, Text, ZIP – Bucket `chat-dateien` (25 MB) |
| 🎤 | Sprachnachrichten | Mikrofon gedrückt halten = aufnehmen, loslassen = senden, nach links wischen = abbrechen, nach oben = sperren (antippen = freihändig); Dauer + Pegel während der Aufnahme; Player mit Wellenform, Zeit und Abspielposition (max. 5 Min.) |
| 📍 | Standortfreigabe | nur nach Bestätigung, Anzeige mit OpenStreetMap-Kachel |
| 📊 | Umfragen | Einzel- oder Mehrfachauswahl, 2–12 Antworten |
| 📞📹 | Sprach- & Videoanrufe | WebRTC im Privatchat, Klingeln überall im Dashboard + Push |
| 🔔 | Push-Benachrichtigungen | pro Gerät aktivierbar, Chats einzeln stummschaltbar |
| ✍️ | „schreibt …“ | flüchtiger Realtime-Broadcast, nichts wird gespeichert |

## Chatarten

Es gibt **ausschließlich** diese drei Chatarten – keinen Teamchat:

1. **Vereinschat** – entsteht automatisch für jeden Verein. Zugriff: alle aktiven Mitglieder des Vereins
   (Vereinsadmin, Trainer/in, Betreuer/in, Tänzer/in, Eltern), nur solange der Verein eine Vereinslizenz hat.
2. **Gruppenchat** – entsteht automatisch für jede Gruppe. Zugriff: Mitglieder, Trainer und Betreuer der Gruppe
   sowie der Vereinsadmin (mit Vereinslizenz). Trainer sehen nur die Gruppen, denen sie zugeordnet sind.
3. **Privatchat (1:1)** – zwischen zwei Personen, siehe Regeln unten.

In Vereins- und Gruppenchats können Vorstand, Trainer und Betreuer den Modus „nur Leitung schreibt“
(Ankündigungen) ein- und ausschalten und Nachrichten moderieren (löschen).

## Privatchat-Regeln (Jugendschutz)

Direktnachrichten sind möglich, wenn **keine Blockierung** und **keine elterliche Nachrichtensperre** besteht und
mindestens eines gilt (Prüfung ausschließlich serverseitig in `darf_direkt_schreiben`):

- beide sind aktive Mitglieder **desselben Vereins mit Vereinslizenz** (gleiche oder andere Gruppe; Trainer/Betreuer
  eingeschlossen) – das gilt auch für Kinder unter 15,
- **Eltern ↔ eigenes Kind** (bestätigte Verknüpfung oder Eltern-Kind-Zuordnung des Vereins),
- eine **Vernetzung wurde angenommen** – nur wenn **beide mindestens 15** sind und **beide Nachrichten** haben
  (ab Basic bzw. über eine Vereinslizenz).

Fremde Erwachsene (auch Trainer anderer Vereine) können Kinder unter 15 weder finden noch anfragen noch anschreiben.

**Altersgrenze:** Maßgeblich ist das tatsächliche Geburtsdatum (Profil, bei der Registrierung Pflicht; zusätzlich die
Mitgliederdaten des Vereins – das jüngste zählt). Bis zum Tag vor dem **15. Geburtstag** gilt der Jugendschutz, ab dem
15. Geburtstag automatisch die normalen Regeln (`ist_unter_15`). Ohne Geburtsdatum gilt der Schutz; bestehende Konten
tragen es einmalig nach (`/geburtsdatum`). Ändern kann es danach nur TanzRaum.

Die Gründe, warum man nicht schreiben kann, zeigt der Chat verständlich an (`schreib_sperrgrund`); Gründe, die die
andere Person betreffen (Alter, Elternsperre), werden dabei nicht verraten.

## Blockieren

Blockieren beendet private Nachrichten, Anrufe und Kontaktanfragen in beide Richtungen; die blockierte Person
findet einen in der Suche nicht mehr. Eine neue Kontaktanfrage kann die Blockierung nicht umgehen.
Nur wer blockiert hat, kann die Blockierung wieder aufheben.

## Datenschutz

- Private Chats sehen nur die Beteiligten – auch nicht die TanzRaum-Administration.
- Bilder, Dateien, Videos und Sprachnachrichten liegen in privaten Buckets; Zugriff nur mit Chatzugriff
  (zeitlich begrenzte, signierte Links).
- Push-Benachrichtigungen enthalten keinen Inhalt; das Gerät holt Titel und Vorschau angemeldet ab.

## Technische Absicherung

Alle Regeln gelten in der Datenbank (RLS + `SECURITY DEFINER`-Funktionen), nicht nur in der Oberfläche.

- Zugriff/Schreiben: `hat_gespraech_zugriff`, `darf_im_gespraech_schreiben`, `darf_direkt_schreiben`,
  `hat_vereinsbeziehung`, `ist_minderjaehrig`, `ist_blockiert`
- Kontakt: `kontakt_aufnehmen`, `kontaktanfrage_senden`, `kontaktanfrage_beantworten`,
  `kontaktanfrage_zurueckziehen`, `nutzer_blockieren`, `nutzer_freigeben`, `meine_kontaktanfragen`, `nutzer_suchen`
- Chats: `chat_liste`, `chat_kopf`, `chat_nachrichten`, `chat_gelesen`, `chat_kontakte`, `chat_einstellung`,
  `chat_stumm_setzen`, `nachricht_loeschen`, `nachricht_reagieren`, `umfrage_abstimmen`
- Anrufe: `anruf_starten`, `anruf_status`, `anruf_signal`, `mein_eingehender_anruf`; verpasste Anrufe per pg_cron
- Gespräche und Teilnehmer können nicht direkt angelegt werden, nur über diese Funktionen.
- Nachrichten-Trigger `pruefe_nachricht` prüft Antworten, Umfragen, Anhänge (Pfad, Existenz, Größe, Typ) und Standort.

Edge Functions:

- `chat-push` – versendet Push für Nachrichten und eingehende Anrufe (vom Datenbank-Trigger über pg_net,
  Geheimnis im Vault). Der VAPID-Schlüssel liegt verschlüsselt im Vault.
- `anruf-ice` – liefert die Verbindungsserver für Anrufe (STUN, optional TURN).

## Anrufe und TURN-Relay (Cloudflare)

Sprach- und Videoanrufe laufen per WebRTC. **Direkte Verbindungen werden bevorzugt**; das Cloudflare-TURN-Relay
wird nur automatisch genutzt, wenn keine direkte Verbindung zustande kommt (z. B. Mobilfunk, Firmen-WLAN).
Während des Anrufs zeigt die Oberfläche „Direkte Verbindung“ bzw. „Verbindung über TanzRaum-Relay“.

Ablauf:

1. Beim Starten bzw. Annehmen fragt der Browser `anruf-ice` mit der Anruf-ID an.
2. Die Edge Function prüft Anmeldung und Beteiligung (`anruf_ice_berechtigt`: nur Anrufer/Angerufener eines
   klingelnden oder aktiven Anrufs) und erzeugt serverseitig **pro Anruf kurzlebige TURN-Zugangsdaten**
   bei Cloudflare (gültig max. 4 Stunden = maximale Anrufdauer).
3. Adressen auf Port 53 werden herausgefiltert (von Browsern blockiert); geliefert werden TURN über UDP, TCP und TLS (443).
4. Bei Verbindungsabbruch wird einmal automatisch neu verbunden (ICE-Neustart), erst dann aufgelegt.

Sicherheit:

- `CLOUDFLARE_TURN_KEY_ID` und `CLOUDFLARE_TURN_API_TOKEN` liegen nur in Supabase → Edge Functions → Secrets
  und werden nur in der Edge Function gelesen (Leerzeichen/Zeilenumbrüche werden abgefangen).
- Weder Secrets noch Zugangsdaten landen im ausgelieferten JavaScript oder in Logs (geloggt wird höchstens ein HTTP-Status).
- Selbsttest für Administratoren (liefert nur Diagnose, nie Zugangsdaten), z. B. per SQL:

  ```sql
  select net.http_post('https://<projekt>.supabase.co/functions/v1/anruf-ice', '{"selbsttest":true}'::jsonb, '{}'::jsonb,
    jsonb_build_object('Content-Type','application/json','x-tanzraum-geheimnis',
      (select decrypted_secret from vault.decrypted_secrets where name = 'chat_push_geheimnis')));
  -- Ergebnis danach in net._http_response
  ```

Alternativ zu Cloudflare kann ein eigener TURN-Server über `TURN_URLS`, `TURN_USERNAME`, `TURN_CREDENTIAL` genutzt werden.

Gruppenanrufe in Vereins- und Gruppenchats sind für später vorgesehen (benötigen einen Konferenzdienst, z. B. LiveKit).
