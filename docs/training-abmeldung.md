# Training & Abmeldung

Neutral für jede Vereinsgruppe (Gruppe, Training, Trainingstermin, Teilnehmer, Abmeldung). **Nur mit Vereinslizenz**:
Free/Basic sehen den Menüpunkt nicht, die Seite zeigt „Teil der Vereinslizenz“, und die Datenbank liefert ohne
Lizenz keine Termine und lehnt Abmeldungen ab.

## Grundregeln

- **Standard = eingeplant (🟢).** Es gibt kein „offen“/„keine Rückmeldung“. 🔴 nur, wenn eine Abmeldung existiert.
- **Eine Abmeldung gilt für genau einen Termin** (Gruppe + Datum, `trainings_abmeldungen` mit UNIQUE
  `(gruppe_id, datum, vereins_mitglied_id)`). Wiederkehrende Termine bleiben unabhängig; abmelden geht nur an einem
  Tag, an dem die Gruppe tatsächlich Training hat (Trigger).
- **Ein Status je Person und Termin:** erneutes Abmelden bzw. Korrigieren ändert den bestehenden Eintrag (Upsert),
  es entstehen keine Duplikate. Zeitpunkt der Abmeldung (`erstellt_am`) bleibt erhalten.
- **Keine Quellenanzeige:** „Abgemeldet ist abgemeldet“. Die Quelle (`selbst`/`eltern`/`manuell`) wird intern
  gespeichert (Nachvollziehbarkeit, Datenexport), aber nirgends angezeigt; der Anzeigetext `grund` enthält sie nicht mehr.

## Gründe (strukturiert in `grund_kategorie`, optionaler Text in `hinweis`)

| Wert | Anzeige |
|---|---|
| `krankheit` | 🤒 Krank |
| `schule` | 🏫 Schule |
| `urlaub` | 🏖️ Urlaub |
| `arzttermin` | 🩺 Arzttermin |
| `veranstaltung` | 💃 Andere Veranstaltung |
| `familie` | 👨‍👩‍👧 Familie / privat |
| `sonstiges` | ✏️ Sonstiger Grund (+ optionaler Text) |

Frühere Werte `arbeit`/`verletzung` bleiben gültig und lesbar. App: `src/lib/training/abmeldegruende.ts`,
DB: `abmeldegrund_text()`, `abmeldegrund_emoji()`.

## Wer sieht und darf was

| | sieht | darf |
|---|---|---|
| Teilnehmer | Trainings aller eigenen Gruppen | sich selbst für heute/später ab- und wieder anmelden |
| Eltern | Trainings aller Gruppen aller zugeordneten Kinder, jedes Kind einzeln | nur zugeordnete Kinder (serverseitig: RLS `eltern_kind_zuordnung`) |
| Trainer (Funktion `trainer` in der Gruppe) | nur betreute Gruppen: Zahl der Abmeldungen, nach Öffnen Name + Grund + Zeitpunkt | Abmeldung eintragen, ändern, entfernen (auch nachträglich) |
| Betreuer (Funktion `betreuer`) mit Bereich „Anwesenheit“ | wie Trainer (nur lesen) | – (unverändert: kein Eintragen) |
| Vereinsadmin | alle Gruppen des Vereins | wie Trainer |
| andere Vereine | nichts | nichts |

Die Rechte stehen in der Datenbank: RLS auf `trainings_abmeldungen` (bestehende INSERT/DELETE-Policies + neue
UPDATE-Policies für Trainer bzw. eigene/Kind-Abmeldungen ab heute), Trigger `trainings_abmeldung_vorbereiten`
(Lizenz, Termin vorhanden, feste Identität beim Ändern), `training_kalender()` (Sichtbarkeit, `abmeldungen` je Termin
nur für betreute Gruppen) und `training_teilnehmer()` (Personenauswahl für „Abmeldung eintragen“, nur Trainer/Admin).

## Oberfläche

- **Menü:** „Training“ ist eigener Hauptpunkt (Sidebar) und steht auf dem Handy direkt in der unteren Leiste
  (2. Position). Badge = ungelesene Hinweise „Neue Abmeldung“; sie gelten beim Öffnen von Training als gelesen.
- **Dashboard + Training:** Block „TRAINING HEUTE“ oben. Teilnehmer: „🟢 Du bist eingeplant“ und großer Knopf
  „❌ VOM TRAINING ABMELDEN“ → Grund wählen → „Vom Training abmelden? … an den zuständigen Trainer übermittelt“
  → „🔴 Du bist für dieses Training abgemeldet. Grund: …“ mit „↩️ Wieder anmelden“ (nur dieser Termin).
  Eltern: je Kind „🧒 Name · 🟢 Emma ist eingeplant · ❌ Emma abmelden“, Frage „Warum kann Emma heute nicht kommen?“.
- **Trainer:** je Termin „🔴 3 Abmeldungen [Abmeldungen anzeigen]“ bzw. „🟢 Keine Abmeldungen“ – keine
  Teilnehmerliste auf der Startkarte. Geöffnet: Zusammenfassung nach Gründen, dann Liste (schmale Karte) bzw.
  Tabelle Name | Grund | Zeitpunkt (breite Karte, per Container Query). „+ Abmeldung eintragen“: Teilnehmer wählen
  (bereits Abgemeldete sind markiert und werden geändert statt doppelt angelegt) → Grund → „Abmeldung speichern“.
- Komponenten: `src/components/training/TrainingKarte.tsx`, `AbmeldeDialog.tsx` (unten einblendendes Fenster auf dem
  Handy, mittig am Desktop), `TrainingKalender.tsx`.

## Benachrichtigungen

Neue Abmeldung (heute oder später) → bestehende `benachrichtigungen` (Typ `training_abmeldung`) an alle Trainer der
Gruppe außer der eintragenden Person, z. B. „🔴 Neue Abmeldung: Anna Müller – 🤒 Krank (Minis, heute)“. Push über den
bestehenden Weg (`chat-push` → `benachrichtigung_push_ziele`) nur, wenn die Push-Kategorie „Neue Abmeldungen in deinen
Gruppen“ in den Einstellungen eingeschaltet ist (Standard: aus, wie bisher festgelegt).

## Grenzen

- Die Abmeldung hängt an Gruppe + Datum. Hat eine Gruppe am selben Tag zwei Trainings, gilt eine Abmeldung für beide.
- Tests: `supabase/tests/training_abmeldung_test.sql` (20 Prüfungen, vollständig zurückgerollt).
