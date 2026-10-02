# TanzRaum Team, Freischaltungen, Workshops und TanzRaum Treff

Stand: 02.10.2026 · Migrationen `20261002090000_team_freischaltung_navigation.sql` und `20261002090100_workshops_treff_wissen.sql`
Test: `supabase/tests/team_workshops_treff_test.sql`

## Grundsatz: Rolle ≠ Berechtigung ≠ Navigation

- **Rolle**: FREE / BASIC / VEREIN (Tarif), Vereinsadmin (im Verein), TanzRaum Team, Moderator, 👑 TanzRaum-Admin.
  Vereinsadmin und Moderator sind voneinander unabhängig.
- **Berechtigung**: Die Datenbank entscheidet immer selbst, über `team_darf(recht)`, RLS und `security definer`-Funktionen.
  Die Oberfläche blendet Schaltflächen nur zusätzlich aus.
- **Navigation**: Sie ist reine Anzeige. Ausblenden oder Sortieren verändert niemals Rechte.

## TanzRaum Team (`team_mitglieder`)

- Verwaltet wird es nur vom TanzRaum-Admin unter *Admin → TanzRaum Team* („+ Teammitglied hinzufügen“).
- Rechte sind Bereiche plus Feinrechte aus `team_rechte_katalog()`:
  Treff, Workshops, Wissensbeiträge (im Treff), News, Spotlight und Nutzerverwaltung.
  Eine Aktion braucht immer auch ihren Bereich.
- Mit „Alle verfügbaren Team-Bereiche verwalten“ (`alle_rechte`) erhält ein Teammitglied alle Bereiche aus dem Katalog.
  Team- und Rechteverwaltung gehören nie dazu, die bleiben beim Admin.
- Die Kennzeichnung lautet „🛡 TanzRaum Team“ bzw. „🛡 TanzRaum Team · Moderator“ und ist optional.
- **TEAM_FREE**: BASIC kostenlos für Teammitglieder, unbefristet oder bis zu einem Datum.
  Das ist eine eigene Freischaltungsart (`abos.freischaltung = 'team_free'`), getrennt von MANUAL_FREE.
- Gesperrte Konten haben keine Team-Rechte.
- Jede Änderung landet im Protokoll (`admin_protokoll`, *Admin → Protokoll*).

## Freischaltungen und Lizenzen (bestehende Tabelle `abos`)

- *Admin → Nutzer freischalten*: FREE/BASIC/VEREIN, kostenlos manuell (MANUAL_FREE) oder regulär bezahlt (manuell),
  unbefristet oder befristet, mit interner Notiz.
- Beenden, Verlängern und Lizenzansicht laufen über `admin_freischaltung_*` und `admin_lizenzen*`.
- Der Tarif wird weiterhin nur über `tarif_neu_berechnen_person` berechnet. Es gibt keine zweite Tariflogik.
- Nach dem Beenden oder nach Ablauf gilt automatisch FREE (über `abos_ablaufen`).
- „Mein Tarif & Lizenz“ zeigt den Status 🟢/🟠/🔴, „Gültig bis“, die restlichen Tage und die Freischaltungsart.
- 14 Tage vor Ablauf sendet `lizenz_ablauf_hinweise_senden()` (Cron 07:13) einen einmaligen Hinweis an die Glocke.

## Navigation

- **Admin-Navigation** (Einstellungen → Admin-Navigation): Der Admin kann Punkte ausblenden und sortieren
  (`profiles.navigation_ausgeblendet`). „Einstellungen“ lässt sich nicht ausblenden.
- **Navigation & Bereiche** (Admin): legt fest, welche Hauptpunkte je Tarif sichtbar sind
  (`plattform_einstellungen.navigation_tarife`). Das ist reine Anzeige; der Zugriff bleibt serverseitig geprüft.
- Vereine können das Modul „Workshops“ ausblenden (`vereins_module`).

## Workshops (`workshops`)

- Nutzbar nur mit TanzRaum-Konto (ab FREE).
- Status: ENTWURF → EINGEREICHT → FREIGEGEBEN / ABGELEHNT → ARCHIVIERT.
  Öffentlich sichtbar sind nur freigegebene Workshops.
- Freigeben und Ablehnen erfolgen zentral (Admin oder Team mit Recht), die einreichende Person wird benachrichtigt.
- Bundesland ist ein Auswahlfeld, angezeigt wird nur der Name.
- Kommende und vergangene Workshops sind getrennt; vergangene bleiben erhalten.
- Filter: Bundesland, Kategorie, Zeitraum. Die Karte nutzt die bestehende Netzwerk-Karte.
- Unter 16 Jahren können keine Workshops eingereicht werden.

## TanzRaum Treff (inkl. Wissensbeiträge)

- **Lesen und Melden** ab FREE. **Schreiben** ab BASIC/VEREIN; FREE sieht „Mitdiskutieren mit TanzRaum BASIC“.
- Unter 16 Jahren ist der Treff nur lesbar.
- Funktionen: Kategorien, Themen, Antworten, beste Antwort, „Hilfreich“, ⭐ TanzRaum empfiehlt, Thema folgen
  (Benachrichtigung bei Antworten), ähnliche Themen und „Aktuell diskutiert“.
- Moderation nach Feinrechten: schließen/öffnen, verschieben, anpinnen, bearbeiten, löschen.
- **Meldungen** liegen in der bestehenden Tabelle `meldungen` mit `bereich = 'treff'`.
  Status: OFFEN / IN PRÜFUNG / ERLEDIGT / KEINE MASSNAHME. Die meldende Person wird über Statusänderungen informiert.
- **Nutzer sperren** (Treff) ist eine befristete oder dauerhafte Treff-Sperre (`treff_sperren`); das Konto bleibt bestehen.
  Eine Kontosperre gibt es nur mit dem Recht `nutzer.sperren`.
- **Nutzer entfernen** blendet alle Treff-Inhalte der Person aus und sperrt sie dauerhaft im Treff.
  Das Konto wird nicht gelöscht.
- **Wissensbeiträge** (`wissen_artikel`) sind eine Inhaltsart *im* Treff (Reiter „📚 Wissensbeiträge“ unter
  `/dashboard/treff/wissen`). Es gibt keinen eigenen Navigationspunkt und keinen eigenen Bereich.
  - Erstellen, bearbeiten und veröffentlichen können Admin und Team mit `wissen.*`-Rechten.
  - Ein Beitrag kann optional mit einer Treff-Diskussion verknüpft werden („💬 Zur Diskussion im TanzRaum Treff →“).
  - Die Treff-Suche findet auch Wissensbeiträge.

## Datenschutz

- Der Admin sieht keine privaten Chats und keine personenbezogenen Vereinsdaten.
- Die Team-Nutzersuche zeigt nur @Nutzername und Name.
- Das Geburtsdatum wird nie angezeigt.
- Der Datenexport (`meine_daten_export`) enthält Workshops, Treff-Beiträge und Team-Mitgliedschaft.
