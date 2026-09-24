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

## Anrufe über Mobilfunk (TURN-Relay)

Ohne Relay funktionieren Anrufe in den meisten WLANs; über Mobilfunk brauchen sie ein TURN-Relay.
Vorgesehen ist **Cloudflare** (1.000 GB/Monat frei). Einrichtung:

1. Cloudflare-Dashboard → **Realtime** (früher „Calls“) → **TURN Server** → **Create**.
2. Turn Token ID und API Token kopieren.
3. Supabase → Edge Functions → **Secrets**:
   `CLOUDFLARE_TURN_KEY_ID` und `CLOUDFLARE_TURN_API_TOKEN` anlegen.

Alternativ ein eigener TURN-Server über `TURN_URLS`, `TURN_USERNAME`, `TURN_CREDENTIAL`.

Gruppenanrufe in Vereins- und Gruppenchats sind für später vorgesehen (benötigen einen Konferenzdienst, z. B. LiveKit).
