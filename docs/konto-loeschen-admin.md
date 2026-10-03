# Administration → Benutzer: Konto löschen trotz kostenloser Freischaltung (03.10.2026)

Migration: `supabase/migrations/20261003140000_konto_loeschen_freischaltung.sql`
Test: `supabase/tests/konto_loeschen_test.sql`

## Fehler

Eine BASIC-Person mit kostenloser, manueller, unbefristeter Freischaltung (ohne Verein, ohne Rolle) ließ sich nicht löschen.

1. **Oberfläche:** „Jetzt endgültig löschen“ war ohne Grund still deaktiviert; warum, stand nirgends.
2. **`konto_loeschung_hindernisse`:** Jedes laufende Abo galt als „laufende BASIC-Lizenz“, auch eine kostenlose manuelle
   Freischaltung. Die kann man nicht kündigen, also war das Konto nie löschbar (auch nicht per Selbstlöschung).
3. **`konto_endgueltig_loeschen`:** Beim Löschen von `auth.users` setzt die Datenbank `abos.user_id` auf NULL. Das
   verletzt `abos_check` (persönliche Abos brauchen eine Person). Der endgültige Löschlauf schlug deshalb für jede Person
   fehl, die je ein BASIC-Abo hatte, auch ein abgelaufenes oder gekündigtes.

## Änderung

- Manuelle Freischaltungen (`anbieter = 'manuell'`: MANUAL_FREE, TEAM_FREE, manuell bezahlt) blockieren nicht mehr. Sie
  enden mit der Löschung. Bezahlte, laufende Abos (Karte/Lastschrift, PayPal, Überweisung) blockieren weiterhin, bis sie
  gekündigt sind.
- Vor dem Löschen von `auth.users` werden die persönlichen Abos der Person (und eine nicht bezahlte Vereinsgründung)
  entfernt. **Rechnungen bleiben unverändert erhalten** (Aufbewahrungspflicht); nur der Kontobezug wird wie bisher
  geleert. Offene Überweisungen, Vereinsmitgliedschaft, JuryRaum-Einträge und Admin-Konten blockieren weiterhin.
- Neu: `admin_konto_loeschung_pruefen(p_user)` (nur TanzRaum-Admin) liefert die Hindernisse und Hinweise. Die
  Detailansicht zeigt sie beim Öffnen von „Konto löschen“:
  - „Löschen derzeit nicht möglich, weil …“ mit dem konkreten Grund (Knopf bleibt aus),
  - Hinweise wie „Die kostenlose manuelle Freischaltung (BASIC, unbefristet) endet mit der Löschung automatisch.“,
  - unter dem Knopf, was noch fehlt („Noch offen: Grund angeben und Bestätigung ankreuzen.“).
- „Sofort endgültig“ nutzt unverändert den bestehenden Ablauf: `admin_konto_loeschen` (sperren, protokollieren) →
  Edge Function `konto-loeschung` (Dateien) → `konto_endgueltig_loeschen`.
- Keine Tabellen, Regeln (RLS) oder Daten werden geändert.
