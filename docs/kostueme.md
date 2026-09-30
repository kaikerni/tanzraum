# Kostüme & Requisiten

Vereinsbereich mit Vereinslizenz (Menü „Kostüme & Requisiten“, Modul `kostueme` – vom Verein abschaltbar).
Migration `20260930012831_kostueme_requisiten`.

## Wer darf was

- **Verwalten** (Inventar, Kostümsätze, Ausgabe, Rücknahme): Vereinsadmin und die Rollen, denen der Vereinsadmin den
  Bereich „Kostüme“ gibt (Vereinsverwaltung → Bereiche; Standard: Betreuer). Prüfung: `darf_kostueme_verwalten(verein)`
  (Vereinslizenz + Vereinsadmin bzw. Bereich `material` aus `meine_bereiche()`).
- **Alle anderen Mitglieder** sehen im selben Menüpunkt nur „Bei mir“: was ihnen – bzw. als Eltern ihren Kindern –
  gerade ausgegeben ist, mit Größe und Rückgabedatum.
- **TanzRaum-Administration: kein Zugriff** (die alten Richtlinien mit Plattform-Admin-Zugriff wurden ersetzt).

## Daten

- `kostuem_gruppen` = Kostümsätze (Name, Farbe, Beschreibung).
- `kostueme` = Inventar: Bezeichnung, Art (Kostüm/Requisit/Zubehör), Satz, Größe, Menge je Eintrag, Zustand
  (neu/gut/gebraucht/Reparatur nötig/defekt), Lagerort, Notiz; `vereins_mitglied_id` = bei wem das Teil gerade ist
  (leer = im Lager), `vergabe_datum`, `rueckgabe` (= Rückgabe bis).
- `kostuem_ausgaben` = Verlauf (wer hatte wann was, Rückgabe mit Zustand).
- Ausgabe/Rücknahme nur über `kostuem_ausgeben` / `kostuem_zuruecknehmen` (Trigger `kostueme_schuetzen` verhindert
  direktes Umschreiben), damit der Verlauf vollständig bleibt. Ausgegebene Teile lassen sich nicht löschen.
- Beim Ausgeben bekommt die Person eine Benachrichtigung (Typ `kostuem`).
- Verlässt ein Mitglied den Verein, bleibt das Teil im Inventar (Fremdschlüssel `on delete set null`).
- Datenexport (`meine_daten_export`) enthält die an die Person ausgegebenen Teile.

## Oberfläche `/dashboard/kostueme`

Kennzahlen (gesamt, im Lager, ausgegeben, überfällig, Reparatur), „Bei mir“, Reiter Inventar (Suche, Filter nach Art,
Satz, Status; neues Teil – auch mehrere Größen auf einmal), Kostümsätze, Verlauf (letzte 100 Vorgänge).

## Fotos

Ein Foto je Teil (Knopf „Foto“): im Browser auf max. 1920 px verkleinert (JPEG), privater Bucket `kostueme`
(5 MB, Pfad `<verein_id>/<teil_id>/<zufall>.jpg`), Spalte `kostueme.bild_pfad` (Trigger prüft den Vereinsordner).
Hochladen/Löschen: `darf_kostueme_verwalten`; Ansehen: wer das Teil sieht (Verwaltung bzw. Person/Eltern, die es haben).
Ersetzen/Entfernen löscht das alte Foto (`fotoSetzen`).

## Erinnerungen

Täglich (`vereins_erinnerungen_taeglich`, Cron `vereins-erinnerungen` 07:05 UTC, nur mit Vereinslizenz): 3 Tage vor dem
Rückgabedatum und nach Ablauf je einmal an Person und verknüpfte Eltern (`kostuem_ausgaben.hinweis_*`).

## Später möglich

Größenvorschlag aus dem Mitgliederprofil, Ausgabe eines ganzen Satzes an eine Gruppe.
