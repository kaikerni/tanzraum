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

## Backup (Free-Plan)

Der Supabase-Free-Plan hat **keine automatischen Backups**. Empfehlung: regelmäßig (mind. wöchentlich und vor
größeren Änderungen) einen Dump ziehen, z. B. `supabase db dump --db-url "<Verbindungs-URL>" -f backup.sql`
(und `--data-only` für die Daten), sicher und verschlüsselt außerhalb von Supabase ablegen. Dateien in Storage
separat sichern. Mit einem bezahlten Plan gibt es tägliche Backups.
