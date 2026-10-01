# Soziale Struktur: Netzwerk, Map, Spotlights, Nachrichten, Jugendschutz

| Bereich | Frage | Route |
|---|---|---|
> Verbindliche Tarifstruktur und Navigation: `docs/tarifstruktur-netzwerk.md`. „TanzRaum Connect“ gibt es nicht mehr –
> der eine soziale Bereich heißt **TanzRaum-Netzwerk**.

| Bereich | Frage | Route | Tarif |
|---|---|---|---|
| 🔎 Nutzer suchen | Wen gibt es? | `/dashboard/netzwerk/suche` | FREE (Name/@Nutzername), ab BASIC mit Kategorien + Ort |
| 🤝 Meine Buddys | Mit wem bin ich verbunden? | `/dashboard/netzwerk/buddys` (Online-Status) | ab BASIC |
| ✉️ Buddy-Anfragen | Wer möchte Buddy werden? | `/dashboard/netzwerk/anfragen` | ab BASIC |
| ✨ Spotlight | Was teilen die Menschen gerade? | eigener Hauptbereich `/dashboard/spotlight` (`docs/spotlight-story-editor.md`) | ansehen alle (Admin-Schalter), erstellen ab BASIC |
| 🗺️ Map | Wo ist TanzRaum? | `/dashboard/netzwerk/map` (Standardansicht, `/dashboard/netzwerk` leitet dorthin) | ab BASIC |
| 🏠 Vereine | Welche Vereine/Gruppen gibt es? | `/dashboard/netzwerk/vereine` | ab BASIC |
| 👤 Profile | Wer ist diese Person / dieser Verein? | `/dashboard/netzwerk/person/[id]`, `/dashboard/netzwerk/verein/[id]` | Personenprofile alle |
| 💬 Nachrichten | Mit wem darf ich kommunizieren? | Menüpunkt „Nachrichten“ (ab BASIC), „Nachricht senden“ im Profil (alle) | siehe Messenger |

**Buddys** = die bisherigen Kontakte/Vernetzungen (`connections`, art `kontakt`) – vorhandene Verbindungen bleiben
erhalten. Buddys anfragen/annehmen ab BASIC (`kontaktanfrage_senden`/`_beantworten` prüfen den Tarif), entfernen
(`buddy_entfernen`), Liste mit Online-Status (`meine_buddys`). Das **Trainer-Netzwerk** bleibt separat (nur vom Verein
zugeordnete Trainer mit Vereinslizenz, `docs/trainer-netzwerk.md`).

Nicht umgesetzt (bewusst): Match, Radar, Newsfeed, dauerhafte Beiträge, Follower, Likes-Zähler,
„Posten als Verein/Gruppe“, zweites Nachrichtensystem.

## Map

- Google Maps (Maps JavaScript API), Farben an TanzRaum angepasst, eigene HTML-Marker per OverlayView, keine Map-ID nötig
  (Vereine rot mit Haus/Logo, Mitglieder als Profilbild mit Goldrand), Infokarte statt Popup, Filter Vereine/Mitglieder.
  Geladen erst nach Klick auf „Karte laden“ (optional pro Gerät gemerkt). Browser-Schlüssel `GOOGLE_MAPS_BROWSER_KEY`
  wird zur Laufzeit vom Server gelesen (in Google Cloud auf `https://tanzraum.app/*` beschränken).
- **Vereine** erscheinen, sobald PLZ/Ort in den Vereinsdaten stehen – beim Speichern wird die Adresse serverseitig
  über die Google Geocoding API in Koordinaten umgewandelt
  (Server-Schlüssel `GOOGLE_MAPS_SERVER_KEY`, in Google Cloud auf die Server-IP beschränken) (`verein_standort_setzen`).
- **Mitglieder** (jedes Alter) nur freiwillig: Einstellungen → „TanzRaum Map“ (Standard **Nein**). **Niemals Straße oder
  Adresse:** gespeichert werden nur PLZ und Ort aus dem Suchergebnis und die **Ortsmitte** (zusätzlich auf ca. 1 km
  gerundet); die Datenbank lehnt Hausnummern und „Straße“ ab. Private Konten nie.
- Verknüpfte Eltern können die Anzeige ihres Kindes ausschalten („Mein Kind darf auf der TanzRaum Map erscheinen“).
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

> **Nur Fotos** (max. 5 MB, im Browser verkleinert), nach 24 Stunden automatisch gelöscht – wegen des Speichers im
> Supabase-Tarif keine Videos.
>
> **Ein-/Ausschalten:** TanzRaum-Administration → Karte „Spotlights“ (Migration `20260930010027_spotlights_schalter`).
> - Schalter an/aus für alle (`plattform_einstellungen.spotlights_aktiv`, Standard aus). Aus = Leiste, Profilbereich,
>   Medien und Erstellen für alle weg; nichts wird gelöscht.
> - Tarife, für die Spotlights erscheinen (`spotlights_tarife`: FREE/BASIC/VEREIN). Die Administration sieht und
>   erstellt Spotlights immer, solange sie eingeschaltet sind.
> - Geprüft in der Datenbank: `spotlights_fuer_mich()` in `darf_spotlight_sehen`, `spotlight_medium_sichtbar`,
>   `spotlight_erstellen` und in der Upload-Regel; die App fragt `spotlights_fuer_mich` ab.

> Die folgende Beschreibung gilt, solange Spotlights eingeschaltet sind.

- Immer **persönlich**: Besitzer ist die angemeldete Person (`spotlight_erstellen` setzt ihn serverseitig), Anzeige nur
  mit persönlichem Namen und Profilbild – nie Verein, Gruppe oder Rolle; kein „Posten als Verein/Gruppe“.
- Nur **Fotos** (im Browser verkleinert, max. 5 MB), optional mit Text und TanzRaum-Smiley; 24 Stunden sichtbar.
- Sichtbarkeit: „Alle im TanzRaum-Netzwerk“ (Standard, auch unter 15) oder „Nur mein Verein & meine Kontakte“ (verknüpfte
  Eltern können das festlegen; private Konten immer nur Verein & Kontakte).
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
- Der Jugendschutz betrifft **nur Direktnachrichten** (Fremde können Kinder unter 15 nicht finden, anfragen oder
  anschreiben). Spotlights und Map sind für alle Altersgruppen gleich.
- **Elternkontrollen** (nur bei bestätigter Verknüpfung, getrennt voneinander, alle optional): 💬 Nachrichten erlauben
  (aus = keine Privatchats außer mit den Eltern, in Gruppenchats nur lesen), 🗺️ Map-Anzeige erlauben (Standard an),
  ✨ Spotlights nur Verein & Kontakte.
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

## Vereinsfunktionen

Zusätzlich zu den festen Systemrollen (Admin, Trainer, Betreuer, Mitglied …) kann jeder Verein freie Funktionen anlegen
(z. B. Vorstand, Hästräger, Musiker): `verein_funktionen`, Zuordnung über `mitglied_funktionen`. Funktionen vergeben
**keine Rechte**; sie dienen nur der Anzeige und Organisation. Pflegen darf, wer den Vereinsbereich „mitglieder“ hat.

## Trainingsabmeldung

Abmeldungen (`trainings_abmeldungen`) haben einen festen Grund (`grund_kategorie`: Krankheit, Verletzung, Urlaub,
Schule/Ausbildung, Arbeit, Familie/privater Termin, Sonstiges) und optional einen Hinweis. Der Trigger
`trainings_abmeldung_vorbereiten` setzt `eingetragen_von` und `quelle` (selbst / eltern / manuell) und erzeugt den
Anzeigetext. Trainer können Abmeldungen auf der Anwesenheitsseite manuell nachtragen (z. B. per WhatsApp erhalten).
Abmeldung und tatsächliche Anwesenheit (`trainings_anwesenheit`) bleiben getrennte Datensätze.
