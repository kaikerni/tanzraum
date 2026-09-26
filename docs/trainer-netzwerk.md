# Trainer-Netzwerk / TanzRaum-Netzwerk

Vereinsübergreifendes Kontaktsystem – „LinkedIn für Karnevalstanz-Trainer“. Route: `/dashboard/trainer-netzwerk`.

## Wer nutzt das Trainer-Netzwerk? (`netzwerk_modus()`)

**Nur** Mitglieder, die der Verein als **Trainer/Trainerin** zugeordnet hat, in Vereinen mit **Vereinslizenz**
(`ist_netzwerk_trainer`), sowie die Plattform-Administration. Vereins-Admins ohne Trainerrolle, Tänzer/innen, Eltern
und Betreuer/innen sehen den Menüpunkt nicht. Gefunden werden ebenfalls nur solche Trainer.

Das frühere „TanzRaum-Netzwerk für Basic-Solo“ ist im neuen **TanzRaum-Netzwerk** (Map, Liste, Spotlights, ab Basic)
aufgegangen – siehe `docs/soziale-struktur.md`.

Nie auffindbar: eigene Person, gesperrte und private Konten, blockierte Personen, unter 15-Jährige.

## Ablauf

1. **Suche** (mind. 2 Zeichen, serverseitig `netzwerk_suchen`): Name, Verein/Rolle und Status
   („Profil ansehen“, „Ausstehend“, „Fragt dich an“, „Verbunden“).
2. **Profil** (`netzwerk_profil`): Vereine, Rolle, betreute Gruppen (Disziplin/Altersklasse).
3. **Verbindungsanfrage** → Annehmen / Ablehnen / Blockieren. Fragen sich beide gegenseitig an, sind sie sofort verbunden.
   Nach einer Ablehnung ist eine neue Anfrage frühestens nach 30 Tagen möglich.
4. **Verbunden** → direkter Chat im TanzRaum-Messenger, eigener, farblich abgesetzter Abschnitt
   „Trainer-Netzwerk“ bzw. „TanzRaum-Netzwerk“ ganz oben. Verbindung jederzeit entfernbar.
5. Benachrichtigungen bei neuer Anfrage und bei Annahme.

## Technik

- Tabelle `connections` (ein Eintrag je Paar) mit `art = 'netzwerk'` – dieselbe Basis wie die Kontaktanfragen im
  Messenger; Netzwerk-Anfragen erscheinen dort aber nicht als Kontaktanfragen.
- Funktionen: `netzwerk_modus`, `netzwerk_suchen`, `netzwerk_profil`, `netzwerk_status`, `netzwerk_anfrage_senden`,
  `netzwerk_anfrage_beantworten`, `netzwerk_anfrage_zurueckziehen`, `netzwerk_verbindung_trennen`,
  `meine_netzwerk_kontakte`; interne Helfer (`ist_netzwerk_trainer`, `netzwerk_sichtbar`, …) sind nicht direkt aufrufbar.
- `chat_liste` ordnet Privatchats mit Netzwerk-Verbindung dem Bereich `netzwerk` zu.
