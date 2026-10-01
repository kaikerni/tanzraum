# „Meine Navigation“ – persönliche Reihenfolge

Stand 01.10.2026 · Migration `20261001115633_spotlight_editor_navigation.sql` · Test `supabase/tests/spotlight_editor_navigation_test.sql`

Jede Person kann die **Reihenfolge** ihrer Menüpunkte selbst festlegen: Einstellungen → **Meine Navigation**
(`/dashboard/einstellungen#navigation`). Gilt für alle Tarife und Rollen und für alle Geräte (im Konto gespeichert).

## Prinzip: Reihenfolge ≠ Rechte

1. `erlaubteNav(zugriff)` (`src/lib/navigation.ts`) baut wie bisher die erlaubten Punkte aus Tarif, Vereinslizenz,
   Rolle/Bereichen, Vereinsmodulen, Musik-/Spotlight-/JuryRaum-Schalter.
2. `inReihenfolge(eintraege, reihenfolge)` sortiert **nur diese** Punkte. Unbekannte oder nicht (mehr) erlaubte
   Einträge der gespeicherten Liste werden ignoriert – ein manipuliertes `navigation_reihenfolge` (z. B. mit
   „/juryraum/dashboard“) kann nichts einblenden. Neu freigeschaltete Bereiche erscheinen an ihrer Standardposition
   (direkt nach ihrem Vorgänger) und können danach verschoben werden; wegfallende verschwinden, der Rest bleibt in
   der persönlichen Reihenfolge.
3. Seiten und Daten prüfen ihre Rechte wie bisher selbst (Server, RLS) – die Navigation ist nur Anzeige.

System-Punkte bleiben fest am Ende: **Mein Tarif, Einstellungen** (+ Support & Hilfe). Unterpunkte (z. B. Mitglieder,
Training … unter „Mein Verein“, Netzwerk- und Nachrichten-Unterpunkte) sind innerhalb ihres Bereichs sortierbar.

## Speicherung

`profiles.navigation_reihenfolge text[]` (nur Menü-Kennungen = Pfade). `meine_navigation()` lesen,
`navigation_speichern(text[])` (nur eigenes Konto, Format `^/[a-z0-9/#_-]{1,80}$`, max. 100, Duplikate entfernt;
`null` = Standard). Keine Berechtigungen in dieser Einstellung.

## Oberfläche

- Ziehen am Griff (Maus sofort, Touch nach kurzem Halten), Element hebt sich an, Platzhalter zeigt die Position.
- Alternativ „Nach oben“/„Nach unten“ (Tastatur, Bedienhilfen).
- Live-Vorschau: Seitenleiste (Computer/Tablet) und untere Handy-Leiste (erste vier Hauptpunkte + „Mehr“).
- „Auf Standard zurücksetzen“ mit Rückfrage.
- Seitenleiste (`AppSidebar`) und Handy-Leiste (`MobileNav`) nutzen dieselbe Reihenfolge; ohne Anpassung gilt die
  bisherige Standardnavigation unverändert.
- Kai kennt die Funktion („Kann ich meine Navigation anpassen?“) und verlinkt dorthin – er ändert nichts selbst.
