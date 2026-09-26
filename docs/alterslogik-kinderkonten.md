# Altersgrenzen, Kinderkonten und Elternzustimmung

## Grenzen

| Alter | Bedeutung | Technisch |
|---|---|---|
| unter 16 | Kinderkonto: Zustimmung eines Elternteils bzw. Trägers der elterlichen Verantwortung, Schutzvoreinstellungen, Jugendschutz im Chat | `ist_unter_16(uuid)`, `datum_unter_16(date)`, Frontend `KINDERKONTO_BIS` |
| ab 16 | eigenständiges Konto | – |
| ab 18 | nur für Elternteile (Zustimmung/Verknüpfung) | `ist_volljaehrig(uuid)`, Frontend `VOLLJAEHRIG_AB` |

Die frühere Grenze 15 (`ist_unter_15`) und die allgemeine 18er-Grenze für Kinder (`ist_minderjaehrig`) gibt es nicht mehr.
Die Prüfung erfolgt immer in der Datenbank; das Frontend nutzt `src/lib/auth/alter.ts` nur für Anzeige und Formularführung.

## Registrierung unter 16

1. Das Kind registriert sich (Name, Geburtsdatum, Geschlecht, E-Mail, Passwort) und gibt die E-Mail-Adresse eines Elternteils an.
2. `handle_new_user` berechnet das Alter. Unter 16 ohne gültige, abweichende Eltern-Adresse wird die Registrierung abgelehnt.
   Sonst: Profil anlegen, `eltern_zustimmungen` (Status `offen`, `loeschen_ab` = +14 Tage) anlegen, Login in Supabase Auth
   sperren (`banned_until` = `kinderkonto_sperre()`), Eltern-Adresse aus den Kontodaten entfernen.
3. Die Server Action ruft die Edge Function `eltern-zustimmung` (`art: anfrage`) auf: einmaliger Link (256 Bit, nur Hash
   gespeichert, höchstens bis zur Löschfrist gültig) an die Eltern-Adresse; höchstens 5 Mails, frühestens alle 5 Minuten.
4. `/eltern/zustimmung?token=…` (ohne Konto): Das Elternteil erklärt „Ich bin volljährig und Träger der elterlichen
   Verantwortung“, stimmt dem Kinderkonto zu und willigt optional in Push ein – oder lehnt ab.
   `eltern_zustimmung_entscheiden` dokumentiert Zeitpunkt, Erklärungen, Umfang (`umfang`), Textversion
   (`zustimmung_textversion()`), Freischaltung und hebt die Sperre auf. Der Link ist danach verbraucht.
   Ablehnung bei Neuregistrierung: Konto wird sofort gelöscht.
5. Danach erhält das Kind die Bestätigungs-Mail (Supabase `resend`), das Elternteil eine Bestätigung mit einem einmaligen
   Link (30 Tage) zum optionalen Verknüpfen eines eigenen Elternkontos (`/eltern/verknuepfen`, Anmelde-Adresse muss der
   Eltern-Adresse entsprechen, Konto muss volljährig sein).
6. Ohne Zustimmung löscht `kinderkonten_aufraeumen()` (Cron `kinderkonten-aufraeumen`, täglich 03:40 UTC) neu registrierte
   Kinderkonten nach 14 Tagen; protokolliert wird nur die Anzahl (`kinderkonto_loeschungen`).

Eine Zuordnung Eltern ↔ Kind durch den Verein zählt nicht als Zustimmung.

## Bestandskonten

- Ohne Geburtsdatum: einmalige Abfrage (`/geburtsdatum`). Unter 16 nur zusammen mit der Eltern-Adresse
  (`geburtsdatum_setzen(p_datum, p_eltern_email)`); das Konto wird dann gesperrt, der Link geht an das Elternteil.
- Unter 16 ohne dokumentierte Zustimmung: Weiterleitung nach `/kinderkonto` (Eltern-Adresse angeben → Sperre + Link).
- Bestandskonten werden nie automatisch gelöscht.
- Das Geburtsdatum kann nur über `geburtsdatum_setzen` eingetragen werden (`profiles_schuetzen`).

## Schutzvoreinstellungen unter 16

| Funktion | Standard | Ändern |
|---|---|---|
| Nachrichten | nur Verein und Eltern, keine Kontaktanfragen, Suche nur per exaktem @Nutzernamen | Eltern können Nachrichten abschalten |
| TanzRaum Map | aus (`ist_auf_map`) | verknüpftes Elternteil (`map_erlaubt`) |
| Spotlights | nur Verein/Kontakte (`spotlight_nur_kontakte`, `spotlight_erstellen` erzwingt „kontakte“) | verknüpftes Elternteil |
| Push | nur mit Einwilligung (restriktive RLS auf `push_subscriptions`) | Zustimmungsseite oder verknüpftes Elternteil |

## Mails an wartende Kinderkonten

Der Auth-Mail-Hook ist unverändert. Klickt ein wartendes Kind auf den ersten Bestätigungslink, lehnt Supabase Auth die
gesperrte Anmeldung ab bzw. `/auth/bestaetigen` beendet die Sitzung sofort und zeigt „wartet auf Zustimmung“.
