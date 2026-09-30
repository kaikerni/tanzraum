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

## Später möglich

Fotos je Teil, Größenvorschlag aus dem Mitgliederprofil, Erinnerung vor dem Rückgabedatum, Ausgabe eines ganzen Satzes
an eine Gruppe.
