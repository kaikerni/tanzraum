# Administration → Benutzer: vollständige Benutzerliste (03.10.2026)

Migration: `supabase/migrations/20261003130000_admin_benutzerliste.sql` (nur eine neue Lesefunktion)
Test: `supabase/tests/admin_benutzerliste_test.sql`

## Was ist neu

Die Seite *Administration → Benutzer* behält „Konto suchen“, „Laufende Löschungen“ und „Protokoll“ und zeigt zusätzlich
**Alle Benutzer**: alle registrierten TanzRaum-Konten.

- **Grundlage:** registrierte Konten (`profiles` + `auth.users`). Vereinsmitglieder ohne eigenes Konto (Mitgliederverwaltung,
  Tabelle `mitglieder`) werden nicht gezählt.
- **Angaben je Konto:** Avatar, Vor-/Nachname, @Name, gekürzte E-Mail (wie bisher, z. B. `le***@beispiel.de`), Tarif
  (FREE/BASIC/VEREIN, farbig) mit Herkunft (bezahlt, kostenlos manuell, Team, über Verein), Verein und Rolle, Status
  (Aktiv / Deaktiviert / Löschung geplant), Registrierung, letzte Anmeldung (nur Datum).
- **Nicht angezeigt:** Chats, Nachrichten, Passwörter, Tokens, Telefonnummer, Geburtsdatum, Standort, Vereins- oder
  Mitgliederdatensätze.
- **Suche** (ab 2 Zeichen): Name, @Name, E-Mail, Verein. **Filter:** Tarif, Status, Verein, Rolle. **Sortierung:** Name,
  @Name, Tarif, Verein, Registrierung (Standard: neueste zuerst). **Seiten:** 20/50/100 pro Seite, „1–50 von 1.248 Benutzern“.
- Alles wird **serverseitig** gefiltert, sortiert und seitenweise geladen (`admin_benutzer_liste`); bei 10.000 Konten
  dauert eine Seite lokal etwa 0,1–0,2 s.
- **Detailansicht** (Klick auf ein Konto): Angaben, „Tarif ändern / freischalten“ (bestehende Freischaltung inkl. laufender
  Lizenzen), Links zu Lizenzen & Freischaltungen, zum Verein in der Administration und zum TanzRaum Team, sowie der
  **bestehende** Löschprozess (Grund, 14 Tage oder sofort, Bestätigung, Protokoll; Vereinsmitglieder entfernt zuerst
  ihr Verein).
- **Handy:** Kartenansicht statt Tabelle, Detailansicht als Blatt von unten, keine horizontale Scrollleiste.

## Sicherheit

`admin_benutzer_liste` prüft `ist_plattform_admin_aktuell()` in der Datenbank (Fehler `42501` für alle anderen), ist für
nicht angemeldete Aufrufe gesperrt und liest nur die genannten Felder. Die Seite selbst leitet Nicht-Admins weiter.
Bestehende Regeln (RLS) bleiben unverändert.
