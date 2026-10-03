# TanzRaum – Datenbank-Migrationen (Baseline)

Diese 12 Dateien bilden den **vollständigen Datenbankstand der Produktion**
(Supabase-Projekt `oraiqjulxmohclfixwdq`, PostgreSQL 17) vom **25.09.2026** ab.
Sie wurden rein lesend aus der Produktions-DB exportiert – an der Produktion
wurde dabei nichts verändert.

Zweck: Den aktuellen Stand reproduzierbar im Repository sichern, sodass sich
eine **neue, leere** Supabase-Datenbank (z. B. Staging, Wiederherstellung,
lokale Entwicklung) exakt so aufbauen lässt wie die Produktion.

## Dateien

| Version | Datei | Inhalt |
|---|---|---|
| 20260925210001 | `baseline_extensions` | pgcrypto, uuid-ossp, pg_stat_statements, pg_net (Schema `extensions`), pg_cron, supabase_vault |
| 20260925210002 | `baseline_tabellen` | 81 Tabellen inkl. Primärschlüssel, UNIQUE- und CHECK-Constraints, Identity-Spalten, Defaults, 2 Spaltenkommentare |
| 20260925210003 | `baseline_funktionen` | 244 Funktionen im Schema `public` (inkl. SECURITY DEFINER, search_path, `custom_access_token_hook`) |
| 20260925210004 | `baseline_fremdschluessel` | 172 Fremdschlüssel |
| 20260925210005 | `baseline_indizes` | 32 zusätzliche Indizes (insgesamt 140 inkl. Constraint-Indizes) |
| 20260925210006 | `baseline_trigger` | 22 Trigger, davon 1 auf `auth.users` (`on_auth_user_created` → `handle_new_user`) |
| 20260925210007 | `baseline_rls_policies` | RLS aktiviert auf allen 81 Tabellen, 179 Policies |
| 20260925210008 | `baseline_rechte` | GRANT/REVOKE für Tabellen, Sequenzen, Spalten (profiles, vereine, nachrichten) und Funktionen |
| 20260925210009 | `baseline_storage` | 7 Storage-Buckets und 22 Policies auf `storage.objects` |
| 20260925210010 | `baseline_realtime` | Realtime-Publikation für 5 Tabellen (Chat, Anrufe) |
| 20260925210011 | `baseline_cron` | 6 pg_cron-Jobs |
| 20260925210012 | `baseline_stammdaten` | Stammdaten: Altersklassen, Disziplinen, Rollen, Sticker, Tarifpreise, Verbände |

Views, Materialized Views und eigene Enums/Typen gibt es in der Datenbank nicht.

**Bewusst nicht enthalten:**
- Nutzer- und Vereinsdaten (keine personenbezogenen Daten im Repository).
- `rechnungs_einstellungen` (Firmen-/Steuerdaten), `paypal_plans`
  (umgebungsspezifische PayPal-IDs) und `turniere` (Inhalte mit Nutzerbezug).
- Werte der Vault-Secrets (siehe unten).
- Von Supabase selbst verwaltete Schemas (`auth`, `storage`, `realtime`,
  `vault`, `cron`, `net`, `graphql` …) – diese legt Supabase bei jedem Projekt an.

## Prüfung

Die Migrationen wurden nacheinander auf einer leeren PostgreSQL-Datenbank
eingespielt (mit Platzhaltern für die Supabase-eigenen Schemas). Danach wurden
Prüfsummen über Spalten, Constraints, Indizes, Funktionsdefinitionen,
Funktionssignaturen, Trigger, Policies, RLS-Status, Tabellen-/Spalten-/Funktionsrechte,
Buckets, Realtime-Tabellen, Cron-Jobs und Stammdaten gebildet. **Alle 15
Prüfsummen stimmen mit der Produktion überein.**

## ⚠️ Wichtig: NICHT gegen die Produktion ausführen

In der Produktion ist all das bereits vorhanden. Die Produktions-DB führt ihre
eigene Migrationshistorie mit **118 Einträgen** (Versionen `20260916131309` bis
`20260925152314`) in `supabase_migrations.schema_migrations`. Diese einzelnen
historischen Migrationen liegen nicht als Dateien im Repository; sie werden
durch diese Baseline zusammengefasst.

Deshalb:
- **Kein `supabase db push` gegen die Produktion**, solange die Historie nicht
  abgeglichen ist – die CLI würde die Baseline sonst erneut einspielen wollen.
- Wenn die Produktion später mit der Supabase CLI verknüpft werden soll, muss
  die Historie einmalig **bewusst** abgeglichen werden, z. B.:
  ```bash
  # Baseline als „bereits angewendet“ markieren (schreibt nur in die Historientabelle)
  supabase migration repair --status applied 20260925210001 20260925210002 20260925210003 \
    20260925210004 20260925210005 20260925210006 20260925210007 20260925210008 \
    20260925210009 20260925210010 20260925210011 20260925210012
  ```
  Die 118 alten Versionen existieren nur remote; die CLI meldet sie beim
  Abgleich. Ob sie per `supabase migration repair --status reverted …` aus der
  Historie entfernt werden, ist eine Entscheidung am Produktionssystem und
  sollte nur nach Rücksprache erfolgen.
- Neue Migrationen müssen einen Zeitstempel **nach** `20260925210012` haben.

## Neue Datenbank aufsetzen

1. Neues Supabase-Projekt anlegen (Region z. B. eu-central-1).
2. Migrationen in Reihenfolge einspielen, z. B. per
   `supabase link --project-ref <neues-projekt>` und `supabase db push`
   oder die Dateien nacheinander im SQL-Editor ausführen.
3. **Vault-Secrets setzen** (Dashboard → Project Settings → Vault, oder SQL
   `select vault.create_secret('<wert>', '<name>');`). Werte niemals ins Repository:
   - `chat_push_geheimnis` – gemeinsames Geheimnis zwischen DB und Edge Functions
     (gleicher Wert wie das Edge-Function-Secret)
   - `vapid_public`, `vapid_private` – Web-Push-Schlüssel (werden über die
     Funktion `public.push_vapid_speichern` im Vault abgelegt)
4. **Cron-Jobs:** Die Jobs `abo-abgleich` und `cleanup-expired-spotlights-hourly`
   rufen Edge Functions über die Projekt-URL `https://oraiqjulxmohclfixwdq.supabase.co`
   auf. Bei einem anderen Projekt die URL in `20260925210011_baseline_cron.sql`
   vor dem Einspielen anpassen.
5. **Auth-Hook:** Wie in der Produktion (dort hat `supabase_auth_admin` das
   Ausführungsrecht) im Dashboard unter Authentication → Hooks den
   „Custom Access Token“-Hook auf `public.custom_access_token_hook` setzen
   (Hooks sind Projekteinstellungen, keine Datenbankobjekte).
6. Edge Functions aus `supabase/functions/` deployen und deren Secrets setzen.
7. Auth-Einstellungen (Site-URL, Redirect-URLs, SMTP/Brevo, E-Mail-Vorlagen)
   im Dashboard übernehmen – auch diese sind keine Datenbankobjekte.

## Bekannte Auffälligkeiten (unverändert aus der Produktion übernommen)

Die Baseline bildet den Ist-Zustand ab – auch diese Punkte, die fachlich zu
prüfen sind:

- **`nachricht_reaktionen`:** Die Tabelle hat sowohl den CHECK
  `nachricht_reaktionen_emoji_check` (feste Emoji-Liste) als auch den
  Fremdschlüssel `nachricht_reaktionen_sticker_fk` (`emoji` → `sticker.id`).
  Beide zusammen verhindern, dass überhaupt eine Reaktion gespeichert werden kann.
- **Storage-Policy „Admin lädt Satzung hoch/ersetzt“** (Bucket `vereinsdokumente`):
  vergleicht `storage.foldername(r.name)` – also den Rollennamen statt des
  Dateipfads. Die Bedingung greift dadurch nie.
