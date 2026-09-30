# Finanzen

Menüpunkt „Finanzen“ (Vereinslizenz, Modul `finanzen`). Migration `20260930054135_finanzen` (bestehende, leere Tabellen
`kassenbuch_eintraege`, `beitragstypen`, `beitraege` erweitert).

## Wer darf was

- **Verwalten:** Vereinsadmin und Rollen, denen der Vereinsadmin den Bereich „Finanzen“ gibt (Vereinsverwaltung →
  Bereiche; Standard: nur Admin). Prüfung `darf_finanzen(verein)`.
- **Mitglieder/Eltern:** sehen ihre eigenen Beiträge unter „Mein Verein“ (`meine_beitraege`) und in Finanzen, falls sie
  keinen Verwaltungszugriff haben.
- **TanzRaum-Administration: kein Zugriff** (alte Richtlinien mit Plattform-Admin ersetzt).

## Funktionen

- **Übersicht** je Jahr: Bestand (inkl. Übertrag), Einnahmen, Ausgaben, Monatsverlauf, Kategorien, überfällige Beiträge.
- **Kassenbuch:** Einnahmen/Ausgaben mit Datum, Betrag, Kategorie, Zahlungsart, Beschreibung und Beleg (PDF/Bild,
  max. 10 MB, privater Bucket `kassenbuch-belege`, Pfad `<verein_id>/…`). CSV-Export je Jahr für die Kassenprüfung
  (`/dashboard/finanzen/export`, Semikolon, deutsches Zahlenformat, Schutz vor Tabellen-Formeln).
- **Beitragsarten:** Name, Betrag, Rhythmus, aktiv; optional **automatisch** mit „nächster Fälligkeit“: der tägliche
  Lauf `vereins_erinnerungen_taeglich` (Cron 07:05 UTC, nur mit Vereinslizenz) legt 14 Tage vorher die Sollstellung für
  alle aktiven Mitglieder (ohne Eltern-Rolle) an und rückt im Rhythmus weiter (einmalig: Automatik endet).
- **Automatische Erinnerungen:** am Fälligkeitstag und – falls noch offen – 7 Tage später je einmal an Mitglied und
  verknüpfte Eltern (`beitraege.hinweis_faellig_am` / `hinweis_ueberfaellig_am`).
- **Beiträge (Sollstellung):** `beitraege_erzeugen` für alle aktiven Mitglieder (ohne Eltern-Konten) oder ausgewählte
  Personen; keine Doppelten je Person/Art/Fälligkeit. „Bezahlt“ (`beitrag_bezahlt`) legt auf Wunsch die Einnahme im
  Kassenbuch an; „Wieder offen“ entfernt sie. „Erinnern“ (`beitrag_erinnern`) schickt eine Benachrichtigung an die
  Person bzw. verknüpfte Eltern (höchstens alle 3 Tage).
- Keine Zahlungsabwicklung; keine Bankverbindungen (Spalte `iban` wird geleert).
- Datenexport enthält die eigenen Beiträge.
