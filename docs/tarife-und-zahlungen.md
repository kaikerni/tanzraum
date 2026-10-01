# Tarife, Vereinslizenz und Zahlungen

## Grundregel

Ein Tarif wird **nie** durch eine Aktion im Browser aktiviert. Ablauf immer:

```
Browser → zahlung-starten (legt Abo "pending" an, leitet zu Stripe/PayPal)
Anbieter → Webhook (Signatur geprüft) → abo_aktualisieren (Datenbank) → tarif_neu_berechnen_*
```

Stripe und PayPal liefern nur Ereignisse. Die Tariflogik liegt **einmal** zentral in der Datenbank.

## Tarife und Preise

| Tarif  | monatlich | jährlich |
|--------|-----------|----------|
| FREE   | 0 €       | –        |
| BASIC  | 2,99 €    | 29,90 €  |
| VEREIN | 29,90 €   | 299 €    |

Preise stehen in `tarif_preise` (Cent). App, Onboarding und Nutzungsbedingungen lesen daraus;
„🎁 2 MONATE GRATIS“ und die Ersparnis werden aus diesen Preisen berechnet (12 × Monat − Jahr).

## Zahlarten

| Tarif | Stripe | PayPal |
|---|---|---|
| BASIC | Karte (inkl. Apple Pay/Google Pay) oder SEPA-Lastschrift | ja |
| VEREIN | nur SEPA-Lastschrift (fester Betrag statt Prozent – spart bei 299 € rund 4 € je Zahlung) | ja |

- Festgelegt in `STRIPE_ZAHLARTEN` (`supabase/functions/_shared/zahlung.ts`), an Checkout als `payment_method_types`.
  Im Stripe-Dashboard müssen **SEPA-Lastschrift** und unter Wallets **Apple Pay/Google Pay** aktiv sein.
- Lastschrift ist verzögert: Stripe setzt das Abo schon auf `active`, während die erste Zahlung noch läuft.
  `stripe-webhook` lässt ein Abo deshalb `pending`, solange die erste Rechnung offen ist (`ersteZahlungOffen`);
  freigeschaltet wird mit `invoice.paid` (in der Regel 3–5 Werktage).
- `past_due` zählt als Zugang (Kulanz bei Verlängerungen). Ein noch nie bezahltes Abo (`pending`) wird dagegen nie
  `past_due` – in Stripe- und PayPal-Webhook abgesichert (z. B. erste Lastschrift geplatzt).
- Rechnungs-Mail nennt die Zahlart (`zahlungsartText` in `rechnung-versenden`).

## Vorzeitiger Leistungsbeginn (Widerruf)

Vor den Bezahlknöpfen steht ein Pflicht-Häkchen: „Ich verlange ausdrücklich, dass TanzRaum vor Ablauf der
Widerrufsfrist mit der Leistung beginnt …“ (Wortlaut/Version: `src/lib/recht/leistungsbeginn.ts`, identisch in
`supabase/functions/_shared/zahlung.ts`, per Test geprüft). `zahlung-starten` lehnt ohne `leistungsbeginn: true` ab
und speichert den Nachweis in `einwilligungen` (art `vorzeitiger_leistungsbeginn`, quelle `kauf`, details mit Abo,
Tarif, Zeitraum, Anbieter und Wortlaut). Sichtbar unter Einstellungen → Datenschutz. Wortlaut rechtlich prüfen lassen;
bei Änderung Version in beiden Dateien erhöhen.

## Datenmodell

- `abos` – ein Datensatz pro Abo: `inhaber` person|verein, Status `pending`, `active`, `trialing`, `past_due`,
  `cancelled`, `expired`, `paused_by_organization`; Anbieter `stripe`|`paypal`|`manuell`.
- `profiles.tarif` = **persönlicher** Tarif (abgeleitet), `vereine.tarif`/`tarif_aktiv_bis` = **Vereinslizenz** (abgeleitet).
  Beide werden nur von `tarif_neu_berechnen_person/verein` geschrieben (Freigabe über `tarif_system_freigabe`).
  Eine Vereinslizenz setzt **nie** `profiles.tarif = verein`.
- Effektiver Zugang: `tarif_von(uid)` / `mein_tarif()` – `verein`, wenn die Person aktives Mitglied eines
  lizenzierten Vereins ist (unbegrenzt viele Mitglieder), sonst der persönliche Tarif.
- `zahlungs_ereignisse` – jedes Webhook-Ereignis nur einmal (Idempotenz).

## Wege

- FREE → BASIC, FREE → VEREIN, BASIC → VEREIN.
- VEREIN kauft der **Vereinsadmin** für seinen Verein („Kauf = Lizenz für meinen Verein“). Ohne eigenen Verein
  kann er ihn auf „Mein Tarif“ direkt anlegen.
- BASIC + Vereinslizenz: Das BASIC-Abo wird **pausiert** (`paused_by_organization`, Stripe `pause_collection=void`,
  PayPal `suspend`) – nicht gekündigt, nicht gelöscht, kein Zurücksetzen auf FREE. Endet die Abdeckung
  (Mitglied entfernt/deaktiviert oder Lizenz abgelaufen), läuft es automatisch weiter (Stripe/PayPal `activate`).
- Kündigen: `abo-verwalten` → zum Laufzeitende; bis dahin bleibt der Tarif aktiv, danach FREE, Konto bleibt.

## Edge Functions

| Funktion | JWT | Zweck |
|---|---|---|
| `zahlung-starten` | ja | Abo anlegen (`abo_anlegen` prüft Berechtigung + Preis), Checkout-URL zurückgeben |
| `stripe-webhook` | nein | Signatur (`STRIPE_WEBHOOK_SECRET`), Ereignisse → `abo_aktualisieren`, Rechnung |
| `paypal-webhook` | nein | Signatur über PayPal-API (`PAYPAL_WEBHOOK_ID`), Stand direkt bei PayPal abfragen |
| `abo-verwalten` | ja | Kündigung zum Laufzeitende |
| `abo-abgleich` | nein, Geheimnis | pg_cron alle 10 Min.: Ablauf, Pausieren/Fortsetzen beim Anbieter |

Abgelöst (HTTP 410, Quellcode in `supabase/archiv/`): `create-checkout-session`, `create-paypal-order`,
`cancel-my-subscription`, `cancel-paypal-subscription`.

Cron: `abos-ablaufen` (DB, alle 10 Min.), `abo-abgleich` (Edge Function, alle 10 Min., Header `x-tanzraum-geheimnis`
aus dem Vault).

## Secrets (Supabase → Edge Functions → Secrets)

`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID`,
`PAYPAL_ENV` (`live`), `TANZRAUM_APP_URL` (`https://tanzraum.app`). Keins davon gelangt in den Browser.

## Selbsttest (Live-Umstellung prüfen)

`abo-abgleich?selbsttest=1` mit Header `x-tanzraum-geheimnis` (Vault `chat_push_geheimnis`, z. B. per `net.http_post`)
liefert ohne Schlüssel: Art des Stripe-Schlüssels (`sk_live_`/`sk_test_`), Webhook-Secret vorhanden, Stripe-Konto
(Zahlungen/Auszahlungen aktiv), Stripe-Webhook auf diese Adresse + fehlende Ereignisse, PayPal-Modus, Anmeldung ok,
PayPal-Webhook-Adresse + fehlende Ereignisse sowie `webhooks_dieser_app` (IDs der Webhooks der App, zu der Client-ID/Secret
gehören – leer heißt: Zugangsdaten stammen aus einer anderen App als der Webhook).

PayPal-Produkt und -Pläne werden in `paypal_plans` getrennt nach Modus zwischengespeichert (`live:…`, `sandbox:…`),
weil Sandbox-IDs im Live-Betrieb nicht existieren. Alte Einträge ohne Präfix werden nicht mehr verwendet.

## Webhooks bei den Anbietern

- Stripe: `https://oraiqjulxmohclfixwdq.supabase.co/functions/v1/stripe-webhook` – Ereignisse
  `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`,
  `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`.
- PayPal: `https://oraiqjulxmohclfixwdq.supabase.co/functions/v1/paypal-webhook` – Ereignisse
  `BILLING.SUBSCRIPTION.ACTIVATED`, `.UPDATED`, `.CANCELLED`, `.SUSPENDED`, `.EXPIRED`, `.PAYMENT.FAILED`,
  `PAYMENT.SALE.COMPLETED`.

## Oberflächen

- **Mein Tarif** (`/dashboard/tarif`): Zugang, persönliches Abo (inkl. pausiert/gekündigt bis), Vereinslizenzen,
  Tarifkarten Monat/Jahr, Stripe/PayPal, Kündigen.
- **Mein Verein** (Admin): Karte „Vereinslizenz“ mit Status, Laufzeit, Käufer, abgedeckten Mitgliedern, pausierten BASIC-Abos.
- **TanzRaum-Administration**: Zähler FREE/BASIC/VEREIN im Dashboard; `/dashboard/admin/tarife` mit Listen
  (Neueste zuerst / Name A–Z, Namensfilter), Vereine → Mitglieder „wer hat was“, letzte Käufe.
- **Push an Plattform-Admins** bei jedem neuen BASIC-Abo und jeder neuen Vereinslizenz (`kauf_melden`, nur beim
  ersten Aktivwerden, nicht bei Verlängerungen).

## Rechnungen

Migration `20260929215046_rechnungen_pdf`.
- Erstellt bei jeder bezahlten Zahlung (`invoice.paid` bzw. `PAYMENT.SALE.COMPLETED`, manuell bei Überweisung) über
  `erstelle_rechnung`; Nummer fortlaufend je Jahr `TR-<Jahr>-0001` (`naechste_rechnungsnummer`, Zähler in
  `rechnungs_einstellungen`, neues Jahr beginnt bei 0001).
- Inhalt: Logo, Aussteller (Stand bei Erstellung in `rechnungen.aussteller`, aus `plattform_anbieter`), Empfänger
  (Person: Name + E-Mail; Verein: Name + Anschrift), Rechnungsnummer/-datum, Leistungszeitraum (`leistung_von/bis`, aus
  Stripe-Rechnungsposition bzw. PayPal-Zahlung), Posten, Gesamtbetrag, Kleinunternehmer-Hinweis (§ 19 UStG) oder
  Netto/USt 19 %, Zahlart, Steuernummer. Alles unveränderlich (`rechnung_unveraenderlich`), 10 Jahre aufbewahrt.
- PDF: `supabase/functions/_shared/rechnung-pdf.ts` (pdf-lib). Edge Function `rechnung-pdf` liefert eine Rechnung oder
  ein Sammel-PDF (je Rechnung eine Seite); Zugriff per RLS (Plattform-Admin alle, Empfänger/Vereinsadmin eigene).
- Versand: `rechnung-versenden` schickt die Rechnung an `empfaenger_email` mit PDF im Anhang (max. 3× pro Rechnung/Tag).
- Administration → Rechnungen (`/dashboard/admin/rechnungen`): Liste mit Jahresfilter und Summe, Zeile anklicken →
  Vorschau, „PDF herunterladen“, „Erneut per E-Mail senden“, „Alle Rechnungen (des Jahres) als PDF“, CSV.

## Vereinslizenz per Überweisung

Nur Verein-Tarif, nur jährlich, ohne Zahlungsanbieter (keine Gebühren). Sichtbar erst, wenn in
Administration → Anbieterangaben Kontoinhaber und IBAN hinterlegt sind (`ueberweisung_moeglich`).

1. Vereinsadmin wählt „Per Überweisung (ohne Gebühren)“ → `ueberweisung_beantragen`: Abo `pending`
   (`anbieter='ueberweisung'`) + Zahlungsaufforderung (`zahlungsaufforderungen`, Referenz `ZA-XXXXXX`, fällig in 14 Tagen).
   Edge Function `zahlungsaufforderung` schickt Mail + PDF (Bankverbindung, Betrag, Verwendungszweck) und
   einen Hinweis an die Anbieter-E-Mail.
2. Solange eine Überweisung offen ist, ist Stripe/PayPal für diesen Verein gesperrt (keine Doppelzahlung).
   Unter „Mein Tarif“ stehen Bankdaten (Kopieren), PDF, erneut senden und Zurückziehen.
3. Geld da → Administration → Rechnungen → „Offene Überweisungen“ → „Zahlung eingegangen“
   (`admin_ueberweisung_bestaetigen`): Lizenz aktiv für 1 Jahr (bei Verlängerung nahtlos ab bisherigem Ende),
   Rechnung mit Leistungszeitraum wird erstellt und automatisch versendet.
4. 30 Tage vor Ablauf legt `abo-abgleich` (`ueberweisung_verlaengerungen`) automatisch eine Verlängerungs-Aufforderung
   an und versendet sie. Ohne Zahlung endet die Lizenz zum Stichtag (`abos_ablaufen`); nie bezahlte Erst-Aufforderungen
   werden nach 30 Tagen storniert.
5. Kündigen unter „Mein Tarif“: Lizenz bleibt bis zum Ende aktiv, offene Aufforderungen werden storniert.

## Backup (Free-Plan)

Der Supabase-Free-Plan hat **keine automatischen Backups**. Empfehlung: regelmäßig (mind. wöchentlich und vor
größeren Änderungen) einen Dump ziehen, z. B. `supabase db dump --db-url "<Verbindungs-URL>" -f backup.sql`
(und `--data-only` für die Daten), sicher und verschlüsselt außerhalb von Supabase ablegen. Dateien in Storage
separat sichern. Mit einem bezahlten Plan gibt es tägliche Backups.

## Darstellung von Tarifen und Leistungsumfang (zentral)

- **Preise:** nur aus `tarif_preise` (`getPreise`, `src/lib/tarife.ts`) – dieselben Werte nutzt der Kauf. Stand: BASIC 2,99 €/Monat
  bzw. 29,90 €/Jahr, VEREIN 29,90 €/Monat bzw. 299 €/Jahr. Jahreshinweis über `jahrKurz` („2 Monate inklusive“) und
  `jahrHinweis` („Bei jährlicher Zahlung sind zwei Monate gegenüber der monatlichen Zahlung enthalten.“) – keine Prozentangaben.
- **Leistungen und Tarifregeln:** `src/lib/tarif-leistungen.ts` (`TARIF_LEISTUNGEN`, `TARIF_KURZ`, `VEREIN_UEBERSICHT`,
  `VEREINSLIZENZ_TEXT`, `KEIN_BASIC_NOETIG_TEXT`, `BASIC_PAUSE_TEXT`, `ABDECKUNG_ENDE_TEXT`, `MITGLIEDERIMPORT_TEXT`).
  Verwendet von Startseite (Preise, „VEREIN enthält unter anderem“, FAQ), Lizenzübersicht, „Mein Tarif“ und Kai.
- Aufgeführt wird nur, was produktiv verfügbar ist. Musik ist gebaut, aber plattformweit ausgeschaltet und deshalb nicht Teil
  des Leistungsumfangs (auf der Startseite als „bald“ markiert).
- Preishinweis „Alle Preise sind Endpreise …“ kommt aus den Anbieterangaben (`kleinunternehmer_hinweis`).
