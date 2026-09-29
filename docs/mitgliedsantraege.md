# Mitgliedsanträge (digitale Beitrittserklärung)

## Grundsatz
- Jede Person ist in TanzRaum **genau einem oder keinem Verein** zugeordnet (`vereins_mitglieder`: eindeutig je `user_id`).
- Vereinsmitgliedschaft ist unabhängig vom TanzRaum-Tarif (Free/Basic).
- Anträge sehen nur Antragsteller, verknüpfte Eltern und Vereinsadmins bzw. Personen mit dem Bereich „Mitgliedsanträge“
  (`beitritt`) – nicht die Plattform-Administration.

## Ablauf
1. **Hinzufügen** (Mitgliedsanträge oder Mitglieder → Mitglied hinzufügen): Person mit Konto per E-Mail/@Handle
   (`verein_person_hinzufuegen`) oder Einladungslink für Personen ohne Konto (`invite_einloesen`).
2. **Anderer Verein?** Dann Freigabe-Anfrage an den bisherigen Verein (`vereinswechsel_anfragen`). Erst nach
   `freigabe_entscheiden(…, true)` wird die Person umgehängt.
3. **Neu**: `aufnahme_status = 'neu'`, nicht aktiv, Antrag `offen`; Benachrichtigung je Vereinseinstellung
   (keine / App / App + E-Mail). Hinweisbanner im Dashboard.
4. **Ausfüllen** (`/dashboard/mitgliedsantrag/[id]`, auch durch verknüpfte Eltern): feste Vereinstexte + Felder,
   Unterschriftsverfahren nach Vereinseinstellung (Bildschirm, Name + Häkchen, Papier). `antrag_einreichen` speichert
   den Formularstand der Einreichung (`vorlage`), danach PDF per E-Mail an den Verein (+ Kopie) über die Edge Function
   `mitgliedsantrag`.
5. **Verein** (`/dashboard/mitgliedsantraege`): prüfen, bearbeiten, drucken (PDF), Papier-Scan hochladen,
   Mitglieds-/Familiennummer, annehmen/ablehnen (`antrag_entscheiden`). Annahme: aufgenommen, ggf. freigeschaltet,
   Nachricht, Aufnahme-PDF im privaten Bucket `mitgliedsantraege`. Ablehnung: Zuordnung wird gelöst, Antrag bleibt
   dokumentiert.

## Formular je Verein
`/dashboard/mitgliedsantraege/formular` – Kopf, Vorstand, Bankverbindungen, Register/Steuernummer, Mitgliedsarten,
Gruppen, abgefragte Felder, Texte (Beispieltexte wiederherstellbar), SEPA, Foto-Einwilligung, Benachrichtigungen.
Regeln, Beispieltexte und Prüfungen: `supabase/functions/_shared/antrag-vorlage.ts` (gemeinsam für App und PDF),
PDF-Aufbau: `supabase/functions/_shared/antrag-pdf.ts`.

Verfahren (vom Verein wählbar): Unterschrift auf dem Bildschirm, Name + Bestätigung, Ausdrucken/Hochladen und
**extern** (eigenes Verfahren des Vereins mit Beschreibung/Link, ohne Unterschrift in TanzRaum). Zusätzlich dürfen
**bestehende Mitglieder** ihre Mitgliedschaft nur bestätigen statt einen neuen Antrag auszufüllen
(Einstellung `bestehende_bestaetigen`, Standard an). Details: `plattform-logik.md`.

## Rechtlicher Hinweis
TanzRaum bildet das vom Verein gewählte Unterschriftsverfahren ab, garantiert aber nicht die rechtliche Wirksamkeit einer
bestimmten Signaturart (insbesondere für SEPA-Lastschriftmandate).
