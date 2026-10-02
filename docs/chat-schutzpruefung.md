# TanzRaum Chat und TanzRaum Schutzprüfung

Stand: 02.10.2026 · Migration `20261002090200_chat_schutzpruefung.sql` · Edge Function `chat-senden`
Tests: `supabase/tests/chat_schutzpruefung_test.sql` und `node --experimental-strip-types supabase/functions/_shared/schutzpruefung_test.ts`

## Kommunikationsbereiche

| Bereich | Zweck | Schutzprüfung |
|---|---|---|
| 💬 **TanzRaum Chat** (`/dashboard/chat`) | öffentlicher Live-Chat der Community | ja |
| 👥 **Vereins-, Tanzgruppen- und eigene Gruppenchats** (bestehend) | Team- und Vereinskommunikation | ja |
| ✉️ **Nachrichten 1:1** (bestehend) | privat | nein – es gelten die bestehenden Jugendschutz- und Elternregeln |
| 🗣️ **TanzRaum Treff** | Themen, Diskussionen, Wissensbeiträge | eigene Moderation |
| 📸 **Spotlight** | Zeigen und Teilen | kein Chat |

- Der TanzRaum Chat ist technisch ein Gespräch vom Typ `tanzraum` in den bestehenden Tabellen `gespraeche` und `nachrichten`.
  Es gibt kein zweites Chatsystem.
- Realtime, Antworten, Reaktionen, Smileys, Löschen und Suche kommen aus dem bestehenden Chatfenster.
- Gruppenchats von Tanzgruppen bleiben an die bestehende Gruppenmitgliedschaft gebunden.
  Es gibt keine zweite Mitgliederverwaltung.

## Freischaltung (TanzRaum-Admin)

Der Admin schaltet unter *Admin → Moderation → TanzRaum Chat – Freigabe* den Chat an oder aus und wählt die Tarife
(FREE, BASIC, VEREIN, frei kombinierbar). Gespeichert wird das in `plattform_einstellungen.chat_aktiv` und `chat_tarife`.

- **Standard: aus.**
- Admin und Moderation mit dem Recht `chat.oeffentlich_moderieren` haben immer Zugang.
- Unter 16 Jahren ist der öffentliche Chat nur lesbar. Das ist einstellbar über `oeffentlich_ab_16`.
- Eine elterliche Nachrichtensperre gilt auch hier.

## Ablauf: Prüfung vor der Veröffentlichung

```
Browser → Edge Function chat-senden (Nutzer-JWT)
  1. schutz_vorpruefung (als Nutzer): Schreibrecht, Schreibsperre, Flut, Wiederholung, Kontext
  2. Feste Schutzregeln (_shared/schutzpruefung.ts)
  3. Externe KI-Prüfung (Anthropic, Modell über SCHUTZ_KI_MODELL, Standard claude-haiku-4-5-20251001)
  4. Nur bei Freigabe: schutz_veroeffentlichen (Service) → INSERT → Realtime → andere sehen die Nachricht
```

- In geschützten Chats darf der Browser **nicht** direkt in `nachrichten` schreiben.
  Die RLS-Regel „Nachrichten schreiben“ schließt `tanzraum`, `verein`, `trainingsgruppe` und `gruppenchat` aus.
- Bearbeiten und Weiterleiten in geschützte Chats laufen ebenfalls über die Prüfung oder sind gesperrt.
- Eine blockierte Nachricht wird nie gespeichert und nie verteilt. Der Absender sieht nur
  „Diese Nachricht konnte nicht veröffentlicht werden.“ – ohne Details zur ausgelösten Regel.
- Ist die KI nicht erreichbar, der Schlüssel fehlt oder die Antwort unklar, wird **nichts veröffentlicht**.
  Der Absender sieht dann „Deine Nachricht konnte gerade nicht geprüft werden. Bitte versuche es später erneut.“

### Feste Schutzregeln

Die Regeln arbeiten mit Normalisierung, damit Umgehungen nicht helfen:
- Leetspeak („h4ll0“), gedehnte Buchstaben, auseinandergeschriebene Wörter („h u r e …“, „n.u.d.e.s“)
- Umlaute und kyrillische Doppelgänger
- unsichtbare Zeichen

Erkannt werden:
- Beleidigungen, Drohungen, Diskriminierung
- sexuelle Inhalte
- Grooming-Signale
- Messenger-Wechsel und Kontaktbitten
- Telefonnummern (auch ausgeschrieben), E-Mails (auch „(at)“), Adressen
- Links (im öffentlichen Chat) und Spam

Wie entschieden wird:
- **Eindeutige Fälle** werden blockiert.
- **Mehrdeutige Begriffe** werden nur als Hinweis an die KI weitergegeben, statt sie sofort zu blockieren.
  So werden Tanzsport-Sätze nicht falsch blockiert.
- **Zusammenhang:** Die letzten eigenen Nachrichten (30 Minuten) fließen ein.
  Beispiel: „wie alt bist du?“ und danach „bist du allein?“ wird als Grooming blockiert.

### KI-Prüfung (Datensparsamkeit)

- Übertragen werden nur der Nachrichtentext und bis zu 5 eigene frühere Texte des Absenders.
- Im öffentlichen Chat kommen bis zu 3 vorherige Texte ohne Namen hinzu, außerdem zwei Flags: öffentlich/Gruppe und „Minderjährige beteiligt“.
- **Nicht** übertragen werden Namen, IDs, Profile, Vereine, Tokens oder Passwörter.
- Der Schlüssel liegt nur als Supabase-Secret `ANTHROPIC_API_KEY` vor und ist nie im Browser.

> **TODO (rechtlich – nicht automatisch erledigt):**
> - AVV mit dem KI-Anbieter
> - Prüfung der Drittlandsübermittlung
> - Ergänzung von Datenschutzerklärung und Nutzungsbedingungen
> - ggf. Datenschutz-Folgenabschätzung (Minderjährige)

## Maßnahmen

Die Schwellenwerte sind einstellbar über `plattform_einstellungen.chat_einstellungen`.

| Verstoß | Maßnahme |
|---|---|
| 1. Verstoß | Nachricht blockiert |
| 2. Verstoß | blockiert + Hinweis an die Person |
| ab 3. Verstoß (oder Schwere 3) | zeitweise Chat-Schreibsperre, 60 Minuten |
| ab 5. Verstoß | Schreibsperre 24 Stunden |

- Ein Moderationsfall entsteht ab dem 3. Verstoß oder bei Schwere 3 (z. B. Grooming oder Drohung).
  Er wird in `meldungen` mit `bereich = 'chat'` und `automatisch = true` angelegt.
- **Nie automatisch:** dauerhafte Kontosperren. Die entscheiden nur Menschen
  (`team_konto_sperren` mit Recht `nutzer.sperren`).
- Ein KI-Ausfall führt zu keiner Maßnahme gegen den Nutzer.

## Melden und Moderation

- ⋮ bzw. Antippen → „Nachricht melden“ mit Grund und optionaler Beschreibung (`chat_nachricht_melden`).
  Die Meldung geht in die bestehende Tabelle `meldungen`.
- *Admin → Moderation* zeigt:
  - Chat-Freigabe, Statistik (nur Zahlen) und Fälle (OFFEN / IN PRÜFUNG / ERLEDIGT / KEINE MASSNAHME)
  - Aktionen: Nachricht entfernen, verwarnen, Schreibsperre 1 Stunde / 24 Stunden / 7 Tage
  - aktive Schreibsperren und die Schwellenwerte
- Neue Team-Rechte im Bereich „Chat“:
  - `chat.oeffentlich_moderieren`
  - `chat.gruppen_moderieren`
  - `chat.meldungen_bearbeiten`
  - `chat.nachrichten_loeschen`
  - `chat.nutzer_stummschalten`
- Moderatoren sehen nur gemeldete bzw. blockierte Auszüge und keinen Einblick in private Gruppenchats.
- Vereinsadmins erhalten keine globalen Moderationsrechte.

## Datensparsamkeit

- `schutz_ereignisse` speichert Kategorie, Schwere, Maßnahme und einen Hash, aber **keinen Text**.
  Die Einträge werden nach 180 Tagen gelöscht.
- Ein Auszug (max. 500 Zeichen) wird nur in einem Moderationsfall gespeichert.
  Er wird beim Abschließen geleert, spätestens nach 90 Tagen.
- Kein Push für den öffentlichen Chat. Es gibt keine „schreibt …“-Anzeige im öffentlichen Chat.

## Kai

Kai bleibt der TanzRaum-Assistent und ist keine KI. Die automatische Prüfung heißt „TanzRaum Schutzprüfung“ und ist ein
eigenes technisches System. Kai erklärt nur auf Nachfrage, warum eine Nachricht nicht gesendet wurde.

## Smileys

Überall, wo TanzRaum-Sticker verfügbar sind, gibt es zusätzlich normale Smileys:
- Chat-Eingabe (fügt in den Text ein)
- Reaktionen in Chats
- Spotlight-Editor und Spotlight-Reaktionen

Die Liste steht in `src/lib/chat/emojis.ts`. Die Anzeige läuft über `ReaktionsBild`.

## Betrieb

1. Supabase-Secret `ANTHROPIC_API_KEY` setzen (Dashboard → Edge Functions → Secrets).
2. Edge Function `chat-senden` deployen.
3. Den Chat unter Admin → Moderation freischalten.

**Wichtig:** Ohne Schlüssel können auch Vereins- und Gruppenchats keine Nachrichten senden (fail closed).
Deshalb den Schlüssel vor dem Einspielen der App setzen.
