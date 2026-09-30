# Kai – der TanzRaum-Begleiter

**Grundsatz: „Wenn du Hilfe brauchst → frag Kai.“** Kai ist ein freiwillig aufrufbarer Hilfe-Assistent.
Er öffnet sich im normalen Betrieb **nie von selbst**, lässt sich jederzeit schließen und unterbricht niemanden.
**Kai ist keine KI** (und wird nirgends so bezeichnet): alle Texte und Antworten sind fest hinterlegt, es gibt keine
externe Schnittstelle. Kai liest keine zusätzlichen Daten, ändert nichts, verschickt nichts und entscheidet nichts –
er erklärt und führt per Link zum passenden Bereich; handeln tut immer die Person selbst.

## Wo Kai erscheint

| Stelle | Art |
| --- | --- |
| Kopfzeile im eingeloggten Bereich | **„✨ Kai – Hilfe?“** (Handy: Kais Gesicht mit Schild „Hilfe?“) – öffnet das Kai-Fenster |
| Kopfzeile der Startseite | „✨ Kai – Hilfe?“ → häufige Fragen |
| Startseite, Bereich „Das ist Kai“ | großer Auftritt (`KaiBuehne`) |
| Onboarding Schritt 1 / Abschluss | großer bzw. kompakter Auftritt (erstes Onboarding) |
| Einstellungen | kompakter, ausblendbarer Hinweis + „Einrichtung mit Kai starten“ |
| Mein Verein (ohne Verein), Support & Hilfe, Fehlerseite, FAQ der Startseite | gezielte Hilfestellung als Sprechblase |

Im Dashboard steht Kai nur als kleiner Knopf in der Kopfzeile – keine Karten, keine Popups.

## Kai-Fenster (Kopfzeile)

- **Begrüßung**: beim ersten Öffnen „👋 Hallo, ich bin Kai! Ich helfe dir dabei, TanzRaum einzurichten. …“, danach „Hallo <Vorname>!“.
- **Einrichtung** Schritt für Schritt (je nach Rolle): Profil, Benachrichtigungen, Privatsphäre, Datenschutz,
  Verein & Gruppen (Mitglied / Vereinsadmin / ohne Verein), App. Je Schritt: Erklärung, Link „öffnen“, Erledigt,
  Überspringen, Zurück, Fortschritt.
- **Tipp für diese Seite** und **Hilfe zu diesem Bereich**: aus der aktuellen Route (Kalender, Training, Anwesenheit,
  Mitglieder, Gruppen unter „Mein Verein“, Turniere, Einstellungen …) – ohne dass jemand erklären muss, wo er ist.
- **Frag Kai**: Freitext → feste Antworten per Stichwort-Treffer, mit Link zum Bereich.
- **Neu in TanzRaum**: Hinweise auf neue Funktionen.
- Links nur zu Bereichen, die die Person im Menü hat.
- Schließen: X, Escape, Tippen daneben; Seitenwechsel schließt das Fenster. Proaktiv höchstens ein roter Punkt am
  Knopf (erster Besuch, als `wichtig` markierte Neuigkeit).
- Das Fenster liegt als eigene Ebene über der Seite (Portal), nur solange es geöffnet ist; auf dem Handy als Blatt
  unter der Kopfzeile oberhalb der unteren Navigation.

## Architektur (erweiterbar, nicht an eine Seite gebunden)

```
src/lib/kai/
  typen.ts      Varianten, Posen, Kontext, Schritte, Tipps, Fragen, Neuigkeiten
  inhalte.ts    Begrüßung, einrichtungsSchritte(kontext), KONTEXT_TIPPS + tippFuer(pfad), NEUIGKEITEN
  fragen.ts     KAI_FRAGEN (mit bereiche), kaiThemen(pfad), kaiFragen(eingabe)  – „Frag Kai“, keine KI
  posen.ts      KAI_POSEN (Pose → Bild), POSE_FUER_VARIANTE, kaiBild()
  speicher.ts   Zustand auf dem Gerät (localStorage „tr_kai“): begrüßt, Schritte, gelesen, ausgeblendet
  steuerung.ts  KAI_FUNKTIONEN (animationen, sprache), kaiOeffnen(modus), kaiVorlesen() (vorbereitet, aus)
src/components/kai/
  KaiFigur.tsx          Bild (voll | portrait), immer freigestellt
  TanzRaumAssistant.tsx Sprechblase im Seitenfluss (welcome, help, info, success, warning, point, setup; kompakt/normal/gross)
  KaiBuehne.tsx         großer Auftritt: Blase über der Figur, nie darauf
  KaiBegleiter.tsx      „✨ Kai – Hilfe?“ + Fenster
  KaiStarten.tsx        Knopf, der Kai von jeder Seite öffnet (z. B. direkt in der Einrichtung)
```

- **Neue Tipps/Fragen/Schritte/Neuigkeiten**: nur in `src/lib/kai/*.ts` ergänzen.
- **Posen** (Begrüßung, Erklären, Hinweis, Idee, Erfolg, Warnung, Turnier/Sport, Nachdenken): vorerst zeigen alle auf
  das Masterbild. Neue Pose = Bild nach `public/images/assistant/` legen und in `posen.ts` eintragen.
- **Sprachausgabe**: `KAI_FUNKTIONEN.sprache` einschalten und `kaiVorlesen(text)` an einen Knopf hängen.
- **Später echte Antworten** (z. B. per KI) könnten `kaiFragen()` ersetzen, ohne die Oberfläche zu ändern – nur nach
  ausdrücklicher Entscheidung.
- **Zustand** liegt bewusst nur auf dem Gerät (keine Datenbankänderung); ein Umzug ins Konto betrifft nur `speicher.ts`.

## Darstellung

- Kai steht immer **ohne Hintergrundfläche** (kein schwarzer Kasten, keine gefüllten Kreise) auf hellen und dunklen Flächen.
- Texte brechen innerhalb ihrer Blase um (auch lange Namen/Wörter), Blasen überlappen die Figur nie.
- Nichts ist dauerhaft fixiert über Inhalten; Animationen nur dezent und nur ohne „Bewegung reduzieren“.

## Bilder

- `public/images/assistant/kai-master.png` – **verbindliches Masterbild** (freigestellt, 1024 × 1536).
- `kai.webp` (512 × 768) und `kai-portrait.webp` (256 × 256) – nur verkleinert/zugeschnitten: `python3 scripts/kai-bilder.py`.

Keine Datenbankänderungen.
