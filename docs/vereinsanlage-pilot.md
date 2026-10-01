# Vereinsanlage, manuelle Lizenz, Vereinsadmin-Einladung, Vereinsbeitritt

Allgemeine Funktionen für **jeden** Verein – der Pilotverein (z. B. „Cannstatter Quellenclub“) ist nur ein
Verein mit manuell freigeschalteter Vereinslizenz (0 €, 1 Jahr). Es gibt keine Sonderlogik für einzelne Vereine.

Migrationen: `20261001004027_vereinsanlage_einladung_beitritt.sql`, `20261001004231_vereinsadmin_einladung_ohne_antrag.sql`
Test (Rollback): `supabase/tests/pilotverein_test.sql`

## 1. Verein anlegen (TanzRaum-Admin)

Administration → Vereine → **Verein anlegen** (Name, Kürzel, Anschrift, Kontakt).
`admin_verein_anlegen(...)` legt nur den Verein an – **keine** Mitgliedschaft, auch nicht für den Admin.
Danach öffnet sich die Vereinsseite (`/dashboard/admin/tarife/verein/<id>?neu=1`).

## 2. Lizenz manuell aktivieren

Vereinsseite → **Lizenz manuell aktivieren**: Lizenz „Verein“, Preis (0 € = kostenlos), Laufzeit (1–24 Monate),
Status Aktiv/Test, Start (heute oder bis 1 Jahr zurück).

- `admin_vereinslizenz_setzen` legt ein normales `abos`-Abo mit `anbieter = 'manuell'` an; `tarif_neu_berechnen_verein`
  setzt `vereine.tarif`/`tarif_aktiv_bis` wie bei jeder Zahlung. Läuft automatisch zum Enddatum aus.
- Eine laufende bezahlte Lizenz (Karte, PayPal, Überweisung) wird nie überschrieben.
- **Manuelle Lizenz deaktivieren** beendet nur manuelle Abos (`admin_vereinslizenz_beenden`).
- Die Vereinsliste zeigt Typ + Status: „Verein · Aktiv/Test bis …“, „Abgelaufen“, „Deaktiviert“, „ohne Lizenz“.

## 3. Vereinsadmin einladen

Vereinsseite → **Vereinsadmin einladen** (E-Mail, optional Versand per E-Mail). Ergebnis: persönlicher Link
`/einladung/<token>` (zufälliger Token, 14 Tage, einmal verwendbar), kopierbar; Status offen / angenommen / abgelaufen /
widerrufen; offene Einladungen können widerrufen werden.

Ablauf für die eingeladene Person: Link öffnen → „Jetzt registrieren“ (normale Registrierung inkl. E-Mail-Bestätigung)
→ anmelden → Einladung annehmen → Vereinsadmin. Es wird **kein Konto automatisch erstellt**. Vom TanzRaum-Admin
erstellte Admin-Einladungen überspringen den Mitgliedsantrag (sonst wäre der erste Admin inaktiv).

## 4. Mitglieder kommen in den Verein

1. **Einladung** durch den Vereinsadmin (Mitglieder → Mitglied hinzufügen / Einladungslink).
2. **Selbst registrieren → Verein suchen → Beitritt anfragen** (`vereine_suchen`, `beitritt_anfragen`). Nur Vereine mit
   gültiger Lizenz sind auffindbar. Der Vereinsadmin entscheidet unter *Mitgliedsanträge → Beitrittsanfragen*
   (`beitrittsanfrage_entscheiden`, Rolle frei wählbar außer Admin). Danach läuft der normale Mitgliedsantrag.
3. Kostenlose Registrierung allein macht **niemanden** zum Mitglied. Genau ein Verein pro Person.

Eine gültige Vereinslizenz schaltet den Mitgliedern die Vereinsfunktionen frei – ohne eigenes BASIC.

## Rechte

| Aktion | TanzRaum-Admin | Vereinsadmin | Mitglied | Free ohne Verein |
|---|---|---|---|---|
| Verein anlegen, Lizenz setzen, Vereinsadmin einladen | ✔ | ✘ | ✘ | ✘ |
| Beitrittsanfragen sehen/entscheiden | ✘ (keine Personendaten) | nur eigener Verein | ✘ | ✘ |
| Verein suchen, Beitritt anfragen | – | – | ✘ (hat Verein) | ✔ |
