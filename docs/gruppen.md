# Gruppen, Altersklassen, Disziplinen – geführter Gruppen-Assistent

## Begriffe (technisch und in der Oberfläche getrennt)

| Begriff | Beispiel | Speicherort |
|---|---|---|
| **Altersklasse** (offiziell, Turnier) | Jugend, Junioren, Ü15 | `altersklassen` (global) → `gruppen.altersklasse_id` |
| **Altersklasse** (frei, ohne Turnierstruktur) | Bambinis, Minis, Erwachsene | `gruppen.altersklasse_frei` (Text) |
| **Gruppe** (auch Tanzpaar/Solist) | Juniorengarde, Garde Blau, Tanzpaar Müller | `gruppen` (`name`) |
| **Disziplin** | Tanzgarden, Gemischte Garde, Tanzpaare, Solist weiblich/männlich, Schautanz | `disziplinen` (`besetzung` solo/paar/gruppe) → `gruppen.disziplin_id` |
| **Personen** | Tänzer, Trainer, Betreuer | `gruppen_mitglieder` (`funktion` mitglied/trainer/betreuer) aus der bestehenden Mitgliederverwaltung |

- Eine Gruppe hat höchstens eine Altersklasse – offiziell **oder** frei (Check `gruppen_eine_altersklasse`).
- Ein Gruppenname darf keine Altersklasse sein („Ü15“, „Junioren“ … werden abgelehnt).
- Welche Disziplin es in welcher offiziellen Altersklasse gibt, steht in `altersklasse_disziplinen`:
  Jugend und Junioren: Tanzpaare, Tanzgarden, Solist weiblich, Solist männlich, Schautanz;
  Ü15 zusätzlich Gemischte Garde. Nicht passende Disziplinen bietet der Assistent nicht an und die Datenbank lehnt sie ab.
  Bei freien Altersklassen ist jede Disziplin (oder keine) möglich.

## Geschlechterlogik (Datenbank `gruppe_speichern`)

- **Tanzpaar** (Besetzung paar): höchstens eine weibliche und eine männliche Person; vollständig = genau eine von beiden.
- **Solist weiblich / männlich** (Besetzung solo): genau eine Person des passenden Geschlechts.
- **Gemischte Garde**: weibliche und männliche Tänzer; der Assistent zeigt die Verteilung und weist auf eine fehlende Seite hin.
- Grundlage ist die Pflichtangabe Geschlecht im Profil.

## Assistent (Mein Verein → Gruppen → „Gruppe anlegen“)

Art (Gruppe / Tanzpaar / Solist) → Name → Altersklasse → Disziplin (dynamisch je Altersklasse) → Tänzer (Suche,
Mehrfachauswahl, „Alle auswählen“; Tanzpaar: weiblich + männlich; Solist: eine Person) → Trainer (Rolle Trainer oder
Vereinsadmin, mehrere Gruppen möglich) → Betreuer (optional, überspringbar) → Übersicht → „Gruppe erstellen“.
„Schnell anlegen“: nur der Name, alles Weitere später.

Gespeichert wird in einem Schritt über `gruppe_speichern()` (gleiche Rechte wie bisher: Vereinsadmin/Trainer; nur mit
Vereinslizenz; nur aktive Mitglieder des eigenen Vereins; eine Aufgabe je Person und Gruppe). Die Mitgliederauswahl
kommt aus `gruppe_assistent_personen()` (nur Vereinsadmin/Trainer).

## Gruppe öffnen (`/dashboard/verein/gruppen/[id]`)

Altersklasse, Disziplin, **Gruppenstärke** (immer aus den zugeordneten Tänzern berechnet; Tanzpaar/Solist =
Teilnehmer), Personen und Trainingszeiten. Vereinsadmin/Trainer: „Mitglieder ändern“, „Trainer ändern“, „Betreuer
ändern“, „Altersklasse ändern“, „Disziplin ändern“, „Gruppe bearbeiten“, „Training anlegen“ (Gruppe vorausgewählt),
Löschen. Andere Mitglieder sehen die Übersicht ohne Tänzernamen.

## Training und Turniere

Trainingszeiten hängen an `trainingstermine.gruppe_id`; Abmeldung, Anwesenheit und Trainer-/Betreuerrechte
(`ist_gruppen_betreuung`) greifen damit direkt für jede Gruppe, auch für Tanzpaare und Solisten.
Turnierbezug: Verein → Altersklasse (`gruppen.altersklasse_id`) → Disziplin (`gruppen.disziplin_id`) → Gruppe →
Personen (`gruppen_mitglieder`). Formationen (Startplanung) bleiben unverändert nutzbar.

Tests: `supabase/tests/gruppen_assistent_test.sql` (20 Prüfungen, vollständig zurückgerollt).
