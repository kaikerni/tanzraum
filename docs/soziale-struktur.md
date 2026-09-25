# Soziale Struktur: Netzwerk, Map, Spotlights, Nachrichten, Jugendschutz

| Bereich | Frage | Route |
|---|---|---|
| 🗺️ TanzRaum Map | Wo ist TanzRaum? | `/dashboard/netzwerk` (Standardansicht) |
| 🌐 Netzwerk (Liste) | Wer und welche Vereine gehören dazu? | `/dashboard/netzwerk?ansicht=liste` |
| ✨ Spotlights | Was teilen die Menschen gerade? | Leiste immer oben im Netzwerk (über Map und Liste) und auf dem Dashboard |
| 👤 Profile | Wer ist diese Person / dieser Verein? | `/dashboard/netzwerk/person/[id]`, `/dashboard/netzwerk/verein/[id]` |
| 💬 Nachrichten | Mit wem darf ich kommunizieren? | Kopfzeilen-Symbol, „Nachricht senden“ im Profil – kein Menüpunkt |

**Zugang:** Netzwerk, Map und Spotlights ab **Basic** (oder automatisch über einen Verein mit Vereinslizenz). **Free**:
nur Kontaktanfragen senden/annehmen, keine Nachrichten. Das **Trainer-Netzwerk** bleibt separat (nur vom Verein
zugeordnete Trainer mit Vereinslizenz, `docs/trainer-netzwerk.md`).

Nicht umgesetzt (bewusst): Connect Match, Radar, Newsfeed, dauerhafte Beiträge, Follower, Likes-Zähler,
„Posten als Verein/Gruppe“, zweites Nachrichtensystem.

## Map

- MapLibre GL mit OpenFreeMap-Kacheln (OpenStreetMap, kein Schlüssel), Farben an TanzRaum angepasst, eigene Marker
  (Vereine rot mit Haus/Logo, Mitglieder als Profilbild mit Goldrand), Infokarte statt Popup, Filter Vereine/Mitglieder.
- **Vereine** erscheinen, sobald PLZ/Ort in den Vereinsdaten stehen – beim Speichern wird die Adresse serverseitig
  über Nominatim in Koordinaten umgewandelt (`verein_standort_setzen`).
- **Mitglieder** nur freiwillig: Einstellungen → „TanzRaum Map“ (Standard **Nein**), nur Ort/Region, auf ca. 1 km
  gerundet, leicht versetzt dargestellt. Private Konten nie.
- **Unter 15:** individuell nur, wenn ein verknüpftes Elternteil „Mein Kind auf der TanzRaum Map anzeigen“ erlaubt.
- DB: `netzwerk_map`, `ist_auf_map`, `map_einstellungen_setzen`, `meine_map_einstellungen`.

## Liste & Profile

- Kategorien Mitglieder, Vereine, Tanzgruppen, Trainer; Suche nach Name/@Handle, Filter Ort/PLZ (`netzwerk_suche`).
- Nicht auffindbar für Fremde: private Konten, Blockierte, **unter 15** (nur im eigenen Verein/für Eltern).
- Personenprofil (`netzwerk_person`): Name, Bild, Verein, Rolle, Tanzgruppen, Ort (ab 15), aktuelle Spotlights;
  Aktionen **Vernetzen** (ab 15 beidseitig), **Nachricht senden** (nur wenn serverseitig erlaubt), **Melden**,
  **Blockieren**. Sehen ist nicht Kontaktieren.
- Vereinsprofil (`netzwerk_verein`): Infos, Standort, Tanzgruppen mit Trainern, Trainer & Vorstand, Mitglieder
  (Fremde sehen nur auffindbare Mitglieder, sonst „und N weitere“).

## Spotlights

- Immer **persönlich**: Besitzer ist die angemeldete Person (`spotlight_erstellen` setzt ihn serverseitig), Anzeige nur
  mit persönlichem Namen und Profilbild – nie Verein, Gruppe oder Rolle; kein „Posten als Verein/Gruppe“.
- Foto, Video (auch ganze Tänze – im Browser verkleinert, max. 50 MB, Länge nicht künstlich begrenzt) oder Text mit
  Farbhintergrund, jeweils optional mit TanzRaum-Smiley; 24 Stunden sichtbar.
- Sichtbarkeit: „Alle im TanzRaum-Netzwerk“ oder „Nur mein Verein & meine Kontakte“ (unter 15 Standard; Eltern können es
  festlegen; private Konten immer nur Verein & Kontakte).
- Vollbild mit Fortschritt, ← →, Tippen/Pfeiltasten, Pause beim Halten, Profil öffnen, Melden, Reaktionen mit
  TanzRaum-Smileys; eigene: Ansichten, Reaktionen, Löschen.
- Privater Bucket `spotlights` (Zugriff per signiertem Link nur bei Sichtbarkeit, `spotlight_medium_sichtbar`).
- Aufräumen: Edge Function `cleanup-expired-spotlights` (stündlich) löscht abgelaufene Spotlights samt Datei –
  **außer** es gibt eine offene Meldung (bleibt für die Administration).
- Aus einem Spotlight entsteht **keine** Kontaktberechtigung.

## Jugendschutz & Elternkonto

Siehe `docs/tanzraum-messenger.md` (Privatchat-Regeln). Zusätzlich:

- **Verknüpfen:** Das Kind erzeugt in Einstellungen → Familie einen Eltern-Code (8 Zeichen, 30 Min.). Das Elternteil
  (volljährig, mit Geburtsdatum) gibt ihn ein. Ist das Kind in einem Verein, **bestätigt der Vereinsadmin** zusätzlich
  (Mitglieder-Seite). Max. 10 Versuche pro Stunde. Auch vom Verein angelegte Eltern-Kind-Zuordnungen zählen.
- **Elternkontrollen** (nur bei bestätigter Verknüpfung, getrennt voneinander): 💬 Nachrichten erlauben (aus = keine
  Privatchats außer mit den Eltern, in Gruppenchats nur lesen), 🗺️ Map-Anzeige, ✨ Spotlights nur Verein & Kontakte.
  Die Freigabe hebt den Grundschutz nie auf.
- **Aufheben** (Elternteil oder Vereinsadmin, nicht das Kind): ohne weiteres Elternteil gelten sofort wieder die
  Standardeinstellungen (`kind_einstellungen` wird gelöscht).
- DB: `eltern_verknuepfungen`, `eltern_codes`, `kind_einstellungen`, `eltern_code_erzeugen`, `eltern_verknuepfen`,
  `eltern_verknuepfung_entscheiden`, `eltern_verknuepfung_aufheben`, `kind_einstellung_setzen`, `meine_kinder`,
  `meine_eltern`, `meine_kind_einstellungen`.

## Melden & Blockieren

- 🚩 Nutzer melden (Profil) und Spotlight melden (Vollbild): unangemessener Inhalt, Belästigung, unerwünschter Kontakt,
  jugendgefährdend, Spam, Sonstiges (`melden`, max. 20 pro Tag).
- TanzRaum-Administration → **Meldungen** (`/dashboard/admin/meldungen`): gemeldetes Spotlight ansehen, entfernen,
  Konto sperren, erledigen. Private Chats sind dort bewusst nicht einsehbar.
- Blockieren hat Vorrang – auch im selben Verein: keine Nachrichten, Anfragen oder Kontaktaufnahme.
