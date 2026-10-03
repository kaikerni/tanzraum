# Vereinsgründung nur mit bestätigter Vereinslizenz (03.10.2026)

Migration: `supabase/migrations/20261003120000_vereinsgruendung_nur_mit_lizenz.sql`
Test: `supabase/tests/vereinsgruendung_test.sql` (Rollback-Test, endet mit `ERGEBNIS:`)

## Grundregel

Ein normaler TanzRaum-Nutzer (FREE oder BASIC) kann **keinen Verein anlegen**, solange keine Vereinslizenz bezahlt und
bestätigt ist. Das erzwingt die Datenbank – nicht nur die Oberfläche:

| Weg | Ergebnis für FREE/BASIC |
|---|---|
| `verein_anlegen` (App, direkter API-Aufruf) | abgewiesen: „Um einen Verein in TanzRaum zu gründen und zu verwalten, benötigst du eine aktive Vereinslizenz.“ (`P0001`, Hinweis `vereinslizenz_erforderlich`) |
| direktes Einfügen in `vereine` | durch RLS gesperrt (keine Einfüge-Regel) |
| direktes Anlegen einer Lizenz in `abos` | gesperrt (keine Rechte) |
| `vereinsgruendung_abschliessen`, `abo_aktualisieren` | nicht für Nutzer aufrufbar (nur Zahlungs-Webhooks, Dienstkonto, TanzRaum-Admin) |
| `admin_verein_anlegen` | nur TanzRaum-Admin |

Zusätzlich kann eine Vereinslizenz **ohne Verein nie aktiv sein** (`abos_check`: `verein_id` darf nur bei
ausstehender/abgebrochener Bestellung leer sein).

## Ablauf

1. FREE/BASIC: „Mein Verein“ → **Verein gründen** → „Vereinslizenz erforderlich“ → **Vereinslizenz kaufen**.
2. „Mein Tarif“ → Karte „Verein“: Vereinsname (und Kürzel) eingeben, Zahlungsart wählen:
   Lastschrift (Stripe), PayPal oder Überweisung (jährlich).
3. Gespeichert wird nur die **Bestellung** (`vereinsgruendungen`: Name, Kürzel, Zahlung) und ein ausstehendes Abo
   ohne Verein. Es gibt **keinen** Vereinseintrag, keine Vereins-ID, keine aktive Lizenz, keine Vereinsadmin-Zuordnung.
4. **Nach bestätigter Zahlung** (Stripe/PayPal-Webhook → `abo_aktualisieren`, bzw. TanzRaum-Admin bestätigt die
   Überweisung → `admin_ueberweisung_bestaetigen`) legt `vereinsgruendung_abschliessen` in einem Schritt an:
   Verein → Lizenz zuordnen → Person wird Vereinsadmin → Vereinstarif VEREIN. Die Person erhält eine Benachrichtigung
   („Dein Verein … ist angelegt“) und landet über „Zum Vereinsbereich“ im normalen Vereinsbereich.
5. Doppelte Zahlungsbestätigungen legen keinen zweiten Verein an. Eine laufende Zahlung (z. B. SEPA-Lastschrift, 3–5
   Werktage) bleibt „ausstehend“ – auch eine Meldung „Zahlung offen“ (past_due) erzeugt keinen Verein.
6. Noch nicht bezahlte Bestellungen kann die Person unter „Mein Tarif“ zurücknehmen; eine beauftragte Überweisung
   kann sie zurückziehen.

Sonderfall: Ist die Person zwischen Bestellung und Zahlungseingang einem anderen Verein beigetreten, wird der Verein
trotzdem mit Lizenz angelegt (die Zahlung geht nicht verloren), der Vereinsadmin aber nicht automatisch gesetzt – die
TanzRaum-Administration erhält dazu eine Benachrichtigung und lädt den Vereinsadmin ein.

## TanzRaum-Admin (unverändert möglich)

- Vereine manuell anlegen (`admin_verein_anlegen`), Lizenzen manuell aktivieren (`admin_vereinslizenz_setzen`,
  z. B. 0 € für Pilotvereine), Vereinsadmin einladen.
- Kostenlose Freischaltungen einzelner Personen (BASIC/VEREIN) – getrennt von der Vereinslizenz; sie erlauben **keine**
  Vereinsgründung.
- Administration → Vereine: neue Übersicht **Vereinsgründungen** (wartet auf Zahlung / Verein angelegt / zurückgenommen).
- Überweisungen einer Gründung erscheinen unter Rechnungen → Offene Überweisungen als „(Neugründung)“.

## Verein löschen (nur TanzRaum-Admin)

Administration → Vereine → Verein öffnen → **Verein löschen**:

1. Prüfung (`admin_verein_loeschen_pruefen`): zeigt nur zusammengefasste Zahlen (Mitglieder mit Konto, Tanzgruppen,
   Trainings, Termine, Dateien, Chats …) – keine Namen von Mitgliedern.
2. Gesperrt, wenn es Rechnungen gibt (Aufbewahrungspflicht), eine laufende bezahlte Vereinslizenz (zuerst kündigen)
   oder eine offene Überweisung.
3. Bestätigung durch Eingabe des Vereinsnamens; die Datenbank prüft alles erneut (`admin_verein_endgueltig_loeschen`).
4. Protokoll: „Verein gelöscht“ mit Name und Zahlen. Persönliche Konten der Mitglieder bleiben erhalten; eine durch den
   Verein pausierte BASIC-Lizenz läuft automatisch weiter. Dateien des Vereins entfernt der nächtliche Speicher-Aufräumlauf.

Es wird **nie automatisch** gelöscht. Die bestehende Funktion `admin_verein_loeschen` bleibt erhalten und läuft jetzt
über dieselben Prüfungen und das Protokoll.

## Bestehende Vereine ohne Lizenz

Bleiben unverändert bestehen. Der Vereinsadmin sieht im Vereinsbereich „Für diesen Verein ist derzeit keine aktive
Vereinslizenz vorhanden.“ mit **Vereinslizenz aktivieren** (bestehender Kaufweg für den Verein).

## Weitere Änderungen

- Fix Nachtlauf: Ausstehende Abos, deren Zahlung beim Anbieter bereits läuft (SEPA-Lastschrift), wurden nach 2 Tagen
  bzw. bei einem neuen Kaufversuch gelöscht – die spätere Zahlungsbestätigung fand ihr Abo dann nicht mehr. Gelöscht
  werden jetzt nur noch ausstehende Abos ohne Anbieter-Abo (Kauf nie abgeschlossen).
- BASIC wird wie bisher erst nach bestätigter Zahlung aktiv (ausstehendes Abo zählt nicht).
- Edge Functions: `_shared/zahlung.ts` (Rechnung an den neu angelegten Verein), `zahlungsaufforderung`
  (Überweisung einer Gründung mit bestelltem Vereinsnamen). Betroffen beim Deployment: `stripe-webhook`,
  `paypal-webhook`, `zahlungsaufforderung`.

## Tests (lokale Kopie der Produktionsdatenbank)

`vereinsgruendung_test.sql`: FREE/BASIC abgewiesen (auch direkt), Bestellung ohne Verein, laufende Zahlung ohne Verein,
Zahlung bestätigt → Verein + Lizenz + Vereinsadmin, doppelte Bestätigung, Überweisung (Gründung) → Admin bestätigt,
Rechnung an den neuen Verein, Zurückziehen/Abbrechen, Bestandsverein kauft wie bisher, Admin legt Pilotverein an,
kostenlose Freischaltung, BASIC erst nach Zahlung, keine aktive Lizenz ohne Verein, Verein löschen (Rechte, Namens-
bestätigung, Schutz bei Rechnung/Lizenz, Protokoll).
