# Turniere & Saisonplanung

## Turniere (`/dashboard/turniere`, für alle)

- **Turnierkalender** aus dem zentralen Katalog (Tabelle `turniere`, gepflegt von der TanzRaum-Administration):
  kommende, gemerkte und vergangene Turniere, Suche, Filter nach Verband und Kategorie, Gruppierung nach Monat.
- **Merkliste** (Stern) – persönlich, `turnier_merkliste`.
- **Detailseite** (`/dashboard/turniere/[id]`): Tage mit Beginn, Ort mit Kartenlink, Ausrichter, Meldeschluss, Ausschreibung,
  eigene Starts mit Rückmeldung, Vereinsplanung (für Berechtigte).
- **„Deine nächsten Starts“**: alle Starts, bei denen man selbst oder das eigene Kind mittanzt – mit Rückmeldung
  **Dabei / Unsicher / Nicht dabei** (für sich selbst und für eigene Kinder).
- Die offizielle Anmeldung beim Verband/Ausrichter bleibt außerhalb von TanzRaum; in TanzRaum wird der Start danach auf
  „Gemeldet“ gesetzt.

## Saisonplanung (`/dashboard/saisonplanung`, Vereinslizenz)

Berechtigt: Vereinsadmin und alle mit Bereich **„saison“** (standardmäßig Trainer/innen), nur mit Vereinslizenz.

- **Starts planen** je Turnier: Gruppe **oder** Solo/Paar (Bezeichnung + Solisten), Disziplin, Altersklasse, Tag,
  Startnummer, Status (**Geplant → Gemeldet**, Abgesagt), Notiz.
- **Zusagen-Übersicht** je Start (dabei/unsicher/nicht dabei/offen) mit Namensliste für Planung und Gruppentrainer.
- **Ergebnisse** nach dem Turnier: Platz, Punkte, Bemerkung.
- **Saisonansicht** (1. August bis 31. Juli, z. B. 2026/27): Kennzahlen, Meldeschluss-Warnungen (≤ 14 Tage, noch nicht
  gemeldet), Turniere der Saison mit allen Starts, Übersicht nach Gruppen, Ergebnisse.
- **Vereinsturniere** (`/dashboard/turniere/neu`): Turniere, die nicht im Katalog stehen (z. B. Freundschaftsturnier) –
  **nur für den eigenen Verein sichtbar**.

## Turnierbeginn

Feste Startzeiten gibt es auf Turnieren nicht – nur den **Beginn je Turniertag** laut Ausschreibung. Er wird
eingetragen, sobald die Ausschreibung vorliegt (Feld „Beginn“ je Tag, gespeichert in `turniere.tage[].beginn`):

- Katalogturniere: TanzRaum-Plattform-Administration über „Turnierdaten bearbeiten“ auf der Turnierseite
  (dort auch Link zur Ausschreibung und Meldeschluss).
- Vereinsturniere: Vereinsadmin/Saisonplanung des Vereins.

Ohne Eintrag zeigt die Turnierseite „Beginn laut Ausschreibung folgt“. Die alten Spalten `beginn_samstag`/`beginn_sonntag`
sind veraltet (leer, nur noch als Rückfall gelesen).

## Kalender & Dashboard

- Turniere im Kalender führen auf die Detailseite und zeigen „Wir starten“ bzw. „Vereinsturnier“.
- Vereinsturniere erscheinen nur bei Mitgliedern dieses Vereins – auch im Dashboard, in „Nächste Termine“, im
  iCal-Abo und in den Kennzahlen (`turnier_sichtbar`).

## Datenbank

| Objekt | Zweck |
|---|---|
| `turniere.verein_id` / `meldeschluss` / `erstellt_von` | Vereinsturniere, Meldeschluss |
| `turnier_starts` | Starts je Verein (RLS: sehen = Mitglieder mit Lizenz, ändern = `darf_vereinstermine_verwalten`) |
| `turnier_start_rueckmeldungen` | Rückmeldungen, nur über `turnier_start_rueckmelden` (eigene Person/Kind, Teilnehmer des Starts, Turnier nicht vorbei) |
| `turnier_merkliste` | persönliche Merkliste |
| `turniere_uebersicht`, `vereins_starts`, `meine_turnierstarts`, `turnier_start_teilnehmer` | Lesefunktionen |
| Trigger `pruefe_turnier`, `pruefe_turnier_start` | Validierung (Tage, Links, Gruppe/Solisten im Verein, Tag im Turnier, Längen) |
| `turnier_starts.formation_id`, Trigger `turnier_start_formation_pruefen` | optionaler Bezug eines Starts zu einer Formation des Vereins |

## Disziplinen, Altersklassen, Formationen

TanzRaum plant Starts – die offizielle Turnieranmeldung läuft weiter über den Verband.

- Disziplinen (`disziplinen.besetzung` solo/paar/gruppe, `mit_thema`): Tanzgarden, Gemischte Garde, Tanzpaare,
  Solist weiblich, Solist männlich, Schautanz (Thema optional).
- Altersklassen Jugend, Junioren, Ü15; `altersklasse_disziplinen` legt fest, welche Disziplin es wo gibt
  (Gemischte Garde nur Ü15).
- Gruppe ≠ Disziplin ≠ Formation: Eine **Gruppe** ist eine Trainingsgruppe im Verein. Eine **Formation** (`formationen`,
  `formation_mitglieder`) ist die konkrete Besetzung einer Disziplin, z. B. „Tanzpaar Anna & Max“, „Solist weiblich Lena“
  oder ein Schautanz mit Thema. Solo höchstens 1, Paar höchstens 2 Personen, nur Mitglieder desselben Vereins.
- Auftrittsname (`formation_mitglieder.auftrittsname`) ist optional; der Mitgliedsname bleibt unverändert.
- BDK-Regel (Tanzpaar = eine weibliche und eine männliche Person) gilt nur im Turnierkontext: `formation_bdk_hinweis`
  liefert einen Hinweis, der nur bei BDK-Turnieren in der Startplanung angezeigt wird. Keine Sperre, keine
  Geschlechtsvorgabe in der Datenbank.
- Verwaltung: Verein → Formationen (Vereinsadmin/Trainer). In der Startplanung kann statt Gruppe/Solo eine Formation
  gewählt werden; Bezeichnung, Personen, Disziplin und Altersklasse werden übernommen.
