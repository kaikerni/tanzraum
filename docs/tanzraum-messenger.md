# TanzRaum-Messenger

Der **TanzRaum-Messenger** ist die komplette Kommunikationsplattform innerhalb von TanzRaum.
In der Oberfläche darf er verkürzt „Messenger“ oder „Chat“ heißen, wenn eindeutig ist, was gemeint ist
(z. B. „Chat“ in der unteren Navigationsleiste auf dem Handy).

Route: `/dashboard/nachrichten` · Tarif: für alle (FREE, BASIC, VEREIN).

## Funktionen

| | Funktion | Umsetzung |
|---|---|---|
| 💬 | Textnachrichten | inkl. Antworten, Kopieren, Löschen, Links, Lesebestätigung (Privatchat) |
| 😊 | Emojis & Reaktionen | Emoji-Auswahl im Eingabefeld, 8 Schnellreaktionen pro Nachricht |
| 📸 | Bilder | werden im Browser verkleinert, privater Bucket `chat-bilder` (5 MB) |
| 🎥 | Videos | privater Bucket `chat-dateien` (25 MB) |
| 📎 | Dateien | PDF, Office, OpenDocument, Text, ZIP – Bucket `chat-dateien` (25 MB) |
| 🎤 | Sprachnachrichten | Aufnahme im Browser (max. 5 Min.), eigener Player |
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

## Privatchat-Regeln

Direkt (ohne Kontaktanfrage) möglich, wenn **keine Blockierung** besteht und mindestens eines gilt:

- beide sind aktive Mitglieder desselben Vereins mit Vereinslizenz (z. B. Tänzer ↔ Trainer, Tänzer ↔ Tänzer),
- Eltern ↔ eigenes Kind (Eltern-Kind-Zuordnung),
- eine Kontaktanfrage wurde angenommen,
- beide sind volljährig.

Sonst – also bei **Fremdkontakten mit Minderjährigen** (auch Kind ↔ Kind aus verschiedenen Vereinen) – entsteht
eine **Kontaktanfrage**. Erst nach „Annehmen“ ist der Privatchat möglich.

- Empfänger sieht: „Neue Kontaktanfrage – Diese Person gehört nicht zu deinem Verein oder deiner Gruppe.“
  mit **Annehmen / Ablehnen / Blockieren**.
- Minderjährige sehen vor dem Senden den altersgerechten Hinweis zum Schutz persönlicher Daten.
- Status: `pending`, `accepted`, `rejected`, `blocked` (Tabelle `connections`).
- Minderjährige sind in der Suche nur über den genauen @Nutzernamen auffindbar, nicht über den Namen.

**Minderjährig** ist, wer laut Geburtsdatum in den Mitgliederstammdaten unter 18 ist; ohne Geburtsdatum,
wer im Verein als Kind mit Eltern verknüpft ist.

Innerhalb des eigenen Vereins gibt es für Minderjährige **keine** zusätzlichen Warnungen und keine Elternfreigabe.

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
