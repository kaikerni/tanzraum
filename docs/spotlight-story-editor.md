# ✨ Spotlight – eigener Bereich mit Story-Editor

Stand 01.10.2026 · Migrationen `20261001115633_spotlight_editor_navigation.sql`, `20261001120429_spotlight_vorschau.sql`
· Test `supabase/tests/spotlight_editor_navigation_test.sql`

Spotlight ist ein **eigener Hauptbereich** (`/dashboard/spotlight`), kein Unterpunkt des TanzRaum-Netzwerks
(`/dashboard/netzwerk/spotlight` leitet um). Bewusst einfach: **Stories ansehen + Stories erstellen** – kein
„Spotlight des Tages“, kein LIVE, kein Ranking, keine Algorithmen. Auf dem Dashboard nur ein dezenter Hinweis bei
neuen Stories.

## Tarife (unverändert serverseitig geprüft)

| | FREE | BASIC / VEREIN |
|---|---|---|
| Ansehen | ✓ (wenn die Administration Spotlights für FREE eingeschaltet hat) | ✓ |
| Erstellen, ansehen der eigenen Statistik, löschen | – | ✓ |

## Übersicht: TanzRaum-Story-Kacheln (keine runden Story-Kreise)

`SpotlightKachel` (`src/components/spotlights/SpotlightLeiste.tsx`): Hochformat 3:4, leicht abgerundet, eigener
Spotlight-Rahmen in Schwarz/Rot/Gold. Neue Stories: Rahmen läuft dezent animiert um (CSS `spotlight-kachel-neu`,
bei „Bewegung reduzieren“ statisch) + ✨-Marke. Vorschaubild = neuestes Foto (signierter Link) bzw. Text-Hintergrund,
sonst Profilbild/Initialen. Erste Kachel „Neue Story“ (ab BASIC). Gitter auf der Spotlight-Seite, eine Kachel im Profil.

## Story-Editor (`SpotlightErstellen.tsx`)

- Medien: 📷 Foto (aufnehmen/hochladen), 🎥 Video (aufnehmen/hochladen, im Browser verkleinert, max. 24 MB),
  📝 Text mit 🎨 Hintergrund. **Mehrere Seiten** (max. 10) – gemeinsame `story_id`, werden nacheinander abgespielt.
- Ebenen (echte Layer über dem Medium, `spotlights.ebenen`): Text (5 Stile, Farben, hinterlegt, Ausrichtung,
  #Hashtags), 😊 TanzRaum-Smileys (alle vorhandenen Sätze: Tanzmariechen, Gardist …), 😀 Emojis, 📍 Standort,
  @Erwähnung, ✏️ Zeichnung.
- Jede Ebene: **antippen, ziehen, mit zwei Fingern vergrößern/verkleinern und drehen, löschen**. Am Computer: Griff
  unten rechts (drehen + Größe), Mausrad (Größe), Umschalt+Mausrad (drehen), Entf, Pfeiltasten, +/−, Q/E.
- Zeichnen: Farben, 3 Strichstärken, Radierer, Rückgängig, Zeichnung löschen. Die Zeichnung ist danach selbst eine
  Ebene (verschieben, skalieren, drehen, löschen).
- 🎵 Musik: aus der **bestehenden TanzRaum-Musik** (eigene Titel bzw. Vereinstitel, die man hören darf) – Titel,
  Ausschnitt (Start), Länge 5–30 s, Lautstärke, Vorschau. Nur bei eingeschaltetem Musikbereich (Administration).
  Abspielen dürfen alle, die die Story sehen dürfen (`spotlight_musik_sichtbar` in der Speicherregel des Buckets `musik`).
- 📍 Standort: Suche (Google Geocoding, serverseitig) oder „Aktueller Standort“ (Koordinaten nur zum Ermitteln des
  Ortsnamens, **nicht gespeichert**) oder eigener Eintrag. Gespeichert wird nur der gewählte Ortsname.
- @Erwähnung: nur Personen, die man auch anschreiben darf (`darf_direkt_schreiben` – Jugendschutz, Blockieren,
  Elternsperre gelten). Der angezeigte Name wird serverseitig gesetzt. Benachrichtigung nur, wenn die Person die
  Story auch sehen kann.
- [Vorschau] zeigt die Story wie später (inkl. Musik) → [Spotlight veröffentlichen] oder [Bearbeiten].

## Ansicht (`SpotlightAnsicht.tsx`)

Vollbild 9:16 mit denselben Ebenen (`StoryEbenen.tsx`), Profilbild/Name, Fortschritt je Seite, Tippen rechts/links,
Wischen links/rechts, nach unten wischen schließt, Halten pausiert, Musik, Reaktionen mit TanzRaum-Smileys, Melden,
eigene Stories: Ansichten, Reaktionen, Löschen. Erwähnungen führen zum Profil. Ältere Spotlights (vor dem Editor)
werden wie bisher angezeigt.

## Datenbank

- `spotlights`: neu `ebenen jsonb`, `musik jsonb`, `hashtags text[]`, `story_id uuid`; Bucket `spotlights` nimmt
  jetzt auch Videos (mp4/webm/mov, 25 MB).
- `spotlight_veroeffentlichen(...)`: alle bisherigen Regeln (Schalter, BASIC, unter 16 nur Verein & Kontakte, 30 pro
  Tag, eigene Datei) + `spotlight_ebenen_bereinigen` (nur bekannte Ebenen/Felder, Grenzen für Position/Größe/Drehung,
  max. 40 Ebenen) + Musik- und Erwähnungsprüfung + Hashtags. `spotlight_erstellen` bleibt für ältere App-Versionen.
- `spotlights_von` liefert zusätzlich Ebenen, Musik (ohne interne Titel-ID), `story_id`.
- `spotlight_musik_auswahl`, `spotlight_musik_sichtbar`, `spotlight_vorschaubilder`.
- Aufräumen nach 24 h unverändert (Musikdateien gehören zur Musikbibliothek und bleiben).

## Offene Punkte (Entscheidung TanzRaum)

- **Musikrechte (GEMA o. ä.)**: Musik in Stories ist für alle Betrachter hörbar. Ob das für hochgeladene Titel
  zulässig ist, muss rechtlich geklärt werden – technisch hängt es am bestehenden Musik-Schalter (derzeit aus).
- **Datenschutzerklärung**: Videos, Standort-Ortsnamen und Erwähnungen in Spotlights ggf. ergänzen.
