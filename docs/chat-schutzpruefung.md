# TanzRaum Chat und TanzRaum Schutzprüfung

Stand: 02.10.2026 · Migration `20261002090200_chat_schutzpruefung.sql` · Edge Function `chat-senden`
Tests: `supabase/tests/chat_schutzpruefung_test.sql` und `node --experimental-strip-types supabase/functions/_shared/schutzpruefung_test.ts`

## Aktueller Stand (02.10.2026)

> **Die externe KI-Prüfung ist DEAKTIVIERT.**
> Chatnachrichten werden aktuell **nicht** an einen externen KI-Anbieter übertragen.
> Es findet kein API-Aufruf an einen KI-Anbieter statt, und es wird kein API-Schlüssel benötigt oder angefordert.
>
> **Aktiv ist die lokale, serverseitige TanzRaum Schutzprüfung:** Vorprüfung in der Datenbank plus feste Schutzregeln in der
> Edge Function `chat-senden`. Sie läuft vollständig innerhalb von TanzRaum (Supabase).

**Zukünftig optional:**
- Eine zusätzliche externe KI-Prüfung ist technisch vorbereitet (`kiPruefen` in `_shared/schutzpruefung.ts`).
- Sie lässt sich erst nach einer separaten datenschutzrechtlichen Prüfung und Freigabe aktivieren
  (siehe „Rechtliche Prüfung vor Aktivierung externer KI“).
- Die Aktivierung erfolgt bewusst über die Server-Konfiguration `CHAT_AI_MODERATION_ENABLED=true`.

| Schalter (Supabase → Edge Functions → Secrets) | Wirkung |
|---|---|
| `CHAT_AI_MODERATION_ENABLED` fehlt oder ≠ `true` (**Standard**) | nur lokale Schutzprüfung; die externe KI wird nie aufgerufen; der Schlüssel wird nicht gelesen |
| `CHAT_AI_MODERATION_ENABLED=true` | lokale Schutzprüfung **und danach** externe KI-Prüfung (fail closed); `ANTHROPIC_API_KEY` nötig |

- Ein vorhandener `ANTHROPIC_API_KEY` schaltet die KI **nicht** automatisch ein. Gezählt wird nur `CHAT_AI_MODERATION_ENABLED`.
- Gültig ist nur genau `true` (Groß-/Kleinschreibung egal). `1`, `yes`, `an` usw. bedeuten AUS. Siehe `kiAktiviert()`.
- In der Moderation (*Admin → 🛡️ Moderation → TanzRaum Schutzprüfung*) steht
  „Lokale Schutzprüfung: aktiv · Externe KI-Prüfung: deaktiviert“.
  Der Wert kommt aus der Edge Function (`{ nur_status: true }`, liefert nur den Schalter).
- Schlüssel und Schalter liegen nur als Supabase-Secrets vor: nie im Browser, nie in `NEXT_PUBLIC_*`, nie im Repository,
  nie in Logs.

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
  2. Feste Schutzregeln (_shared/schutzpruefung.ts)                       ← AKTIV
  3. OPTIONAL, STANDARD AUS: externe KI-Prüfung                           ← nur bei CHAT_AI_MODERATION_ENABLED=true
  4. Nur bei Freigabe: schutz_veroeffentlichen (Service) → INSERT → Realtime → andere sehen die Nachricht
```

- In geschützten Chats darf der Browser **nicht** direkt in `nachrichten` schreiben.
  Die RLS-Regel „Nachrichten schreiben“ schließt `tanzraum`, `verein`, `trainingsgruppe` und `gruppenchat` aus.
- Bearbeiten und Weiterleiten in geschützte Chats laufen ebenfalls über die Prüfung oder sind gesperrt.
- Eine blockierte Nachricht wird nie gespeichert und nie verteilt. Der Absender sieht nur
  „Diese Nachricht konnte nicht veröffentlicht werden.“ – ohne Details zur ausgelösten Regel.
- **KI aus (Standard):** Nach den festen Regeln geht die Nachricht direkt in die normale Chatlogik. Ohne KI gibt es
  nie den Fehler „nicht geprüft“.
- **Nur bei eingeschalteter KI:** Ist sie nicht erreichbar, fehlt der Schlüssel oder ist die Antwort unklar, wird
  **nichts veröffentlicht**. Der Absender sieht dann
  „Deine Nachricht konnte gerade nicht geprüft werden. Bitte versuche es später erneut.“

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
- **Mehrdeutige Begriffe** („Verdacht“) werden nicht sofort blockiert, damit Tanzsport-Sätze nicht falsch blockiert werden.
  - Ist die KI aus (Standard), wird die Nachricht veröffentlicht. Sie kann wie jede Nachricht gemeldet werden.
  - Ist die KI an, geht der Verdacht als Hinweis an die KI.
- **Immer lokal blockiert, auch ohne KI:**
  - Kontaktdaten im öffentlichen Chat bzw. bei Beteiligung Minderjähriger
  - Messenger-Wechsel mit Kontaktbitte
  - sexuelle Inhalte bei Minderjährigen
  - Beleidigungen, Drohungen, Diskriminierung
  - Links im öffentlichen Chat
  - Kombinationen über mehrere Nachrichten
- **Zusammenhang:** Die letzten eigenen Nachrichten (30 Minuten) fließen ein.
  Beispiel: „wie alt bist du?“ und danach „bist du allein?“ wird als Grooming blockiert.

### Externe KI-Prüfung – vorbereitet, derzeit DEAKTIVIERT

Für den Fall einer späteren Aktivierung ist sie so vorbereitet:
- Übertragen würden nur der Nachrichtentext und bis zu 5 eigene frühere Texte des Absenders.
- Im öffentlichen Chat kämen bis zu 3 vorherige Texte ohne Namen hinzu, außerdem zwei Flags: öffentlich/Gruppe und „Minderjährige beteiligt“.
- **Nicht** übertragen würden Namen, IDs, Profile, Vereine, Tokens oder Passwörter.
- Der Schlüssel läge nur als Supabase-Secret `ANTHROPIC_API_KEY` vor und wäre nie im Browser.
  Er wird nur gelesen, wenn der Schalter an ist.
- Anbieter, Modell und Ablauf sind ein technischer Vorschlag. Ob und mit welchem Anbieter die KI genutzt wird, ist
  offen (siehe unten).

## Rechtliche Prüfung vor Aktivierung externer KI

> **Offen – nicht erledigt.** Die folgenden Punkte sind als **offene rechtliche Prüfung** dokumentiert.
> Diese Liste trifft keine Aussage darüber, welche rechtliche Lösung zulässig oder erforderlich ist.
> Die externe KI darf erst eingeschaltet werden, wenn diese Punkte geprüft und freigegeben sind.

- [ ] Prüfung des konkreten KI-Anbieters (Vertragspartner, Sitz, Verarbeitungsorte, Unterauftragnehmer)
- [ ] Prüfung eines erforderlichen Auftragsverarbeitungsvertrags (AVV/DPA)
- [ ] Prüfung der Datenverarbeitung durch den Anbieter (Zwecke, Speicherung beim Anbieter, Nutzung für Training,
      Missbrauchsprüfung)
- [ ] Prüfung einer möglichen Drittlandsübermittlung
- [ ] Prüfung geeigneter Garantien bzw. eines bestehenden Angemessenheitsbeschlusses, soweit relevant
- [ ] Ergänzung/Anpassung der Datenschutzerklärung
- [ ] Ergänzung der Nutzungsbedingungen bzw. Chatregeln
- [ ] Information der Nutzer über die Verarbeitung
- [ ] Besondere Prüfung im Hinblick auf minderjährige Nutzer
- [ ] Prüfung, ob eine Datenschutz-Folgenabschätzung erforderlich ist
- [ ] Prüfung von Speicherfristen und Löschkonzept
- [ ] Prüfung der technischen und organisatorischen Maßnahmen

**Technisch zum Aktivieren (erst nach Freigabe):**
1. Supabase-Secret `ANTHROPIC_API_KEY` setzen.
2. Supabase-Secret `CHAT_AI_MODERATION_ENABLED=true` setzen.
3. In der Moderation prüfen, ob „Externe KI-Prüfung: aktiviert“ angezeigt wird.

Zum Deaktivieren das Secret entfernen oder auf `false` setzen.

## Bestehende Chatregeln und Rechtstexte – Feststellung (ohne Änderung)

| Wo | Stand | Bei späterer externer KI zu berücksichtigen? |
|---|---|---|
| Chatregeln-Dialog im TanzRaum Chat (`ChatFenster.tsx`, „Willkommen im TanzRaum Chat“) | vorhanden: Respekt, keine Beleidigungen, keine persönlichen Daten, „Nachrichten erscheinen erst nach der TanzRaum Schutzprüfung“; keine Aussage zu einer KI | ja – Hinweis auf eine externe Prüfung müsste geprüft werden |
| Nutzungsbedingungen, Abschnitt 6 „Verhalten auf TanzRaum“ | allgemeine Verhaltensregeln und Jugendschutz vorhanden | ja |
| Nutzungsbedingungen: eigene Regeln für TanzRaum Chat / automatische Prüfung vor Veröffentlichung | **nicht vorhanden** | TODO |
| Datenschutzerklärung: TanzRaum Chat, lokale Schutzprüfung (Schutzereignisse, Auszüge in Fällen, Schreibsperren), Chat-Meldungen | **nicht vorhanden** (Abschnitt 7 behandelt Nachrichten allgemein) | TODO – betrifft schon die lokale Prüfung, unabhängig von einer KI |
| FAQ/Startseite, „Frag Kai“ | beschreiben die automatische TanzRaum Schutzprüfung, ohne KI | ja |

> **TODO (rechtlich, offen):**
> - Die Ergänzung von Datenschutzerklärung und Nutzungsbedingungen für den TanzRaum Chat und die lokale Schutzprüfung
>   ist noch zu prüfen und freizugeben.
> - Für eine externe KI kämen die Punkte oben hinzu.
> - Keine dieser Ergänzungen ist bisher als endgültig freigegeben eingebaut.

## Maßnahmen

Die Schwellenwerte sind einstellbar über `plattform_einstellungen.chat_einstellungen`.

| Verstoß | Maßnahme |
|---|---|
| 1. Verstoß | Nachricht blockiert |
| 2. Verstoß | blockiert + Hinweis an die Person |
| ab 3. Verstoß (oder Schwere 3) | zeitweise Chat-Schreibsperre, 60 Minuten |
| ab 5. Verstoß | Schreibsperre 24 Stunden |

Verstöße kommen aus den festen Regeln und, nur bei eingeschalteter KI, zusätzlich aus der KI.

- Ein Moderationsfall entsteht ab dem 3. Verstoß oder bei Schwere 3 (z. B. Grooming oder Drohung).
  Er wird in `meldungen` mit `bereich = 'chat'` und `automatisch = true` angelegt.
- **Nie automatisch:** dauerhafte Kontosperren. Die entscheiden nur Menschen
  (`team_konto_sperren` mit Recht `nutzer.sperren`).
- Ein KI-Ausfall (nur bei eingeschalteter KI) führt zu keiner Maßnahme gegen den Nutzer.

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
eigenes technisches Sicherheitssystem, nicht Kai. Kai erklärt nur auf Nachfrage, warum eine Nachricht nicht gesendet
wurde. Solange die externe KI deaktiviert ist, gibt es in der Schutzprüfung ohnehin keine KI.

## Smileys

Überall, wo TanzRaum-Sticker verfügbar sind, gibt es zusätzlich normale Smileys:
- Chat-Eingabe (fügt in den Text ein)
- Reaktionen in Chats
- Spotlight-Editor und Spotlight-Reaktionen

Die Liste steht in `src/lib/chat/emojis.ts`. Die Anzeige läuft über `ReaktionsBild`.

## Betrieb

1. Migrationen einspielen und die Edge Function `chat-senden` deployen. Es wird **kein** API-Schlüssel und **kein**
   KI-Secret benötigt.
2. Die App installieren. Vereins-, Tanzgruppen- und Gruppenchats senden ab dann über die lokale Schutzprüfung.
3. Den TanzRaum Chat bei Bedarf unter Admin → Moderation freischalten (Standard: aus).

**Wichtig:** Die App muss erst nach dem Deploy von `chat-senden` installiert werden. Sonst können Vereins- und
Gruppenchats nicht senden, denn der direkte Weg ist per RLS gesperrt.
