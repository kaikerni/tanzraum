# News, Umfragen und TanzRaum-Ankündigungen

## Vereins-News

- Menü **News & Umfragen** (`/dashboard/news`, Vereinslizenz). Relevante News und offene Umfragen erscheinen zusätzlich
  auf dem Dashboard.
- Zielgruppen: ganzer Verein, einzelne/mehrere Gruppen, Eltern einer Gruppe, Rollen (Vereinsadmins, Trainer/innen,
  Betreuer/innen, Tänzer/innen, Eltern). Eltern werden über die Vereinszuordnung und über bestätigte Kontoverknüpfungen
  gefunden.
- Verfassen: Vereinsadmin immer (alle Zielgruppen). Der Vereinsadmin legt fest, ob zusätzlich Trainer und/oder Betreuer
  News und Umfragen erstellen dürfen (Standard: Trainer) – diese nur für Gruppen, die sie als Trainer/Betreuer begleiten
  (inkl. Eltern dieser Gruppen). Geprüft in der Datenbank (`darf_news_verfassen`, `ziele_pruefen`).
- Die Empfänger werden bei der Veröffentlichung festgehalten (`news_empfaenger`); Verfasser und Vereinsadmin sehen
  „x von y gelesen“ inklusive Namen und Zeitpunkt.
- **Wichtig – als Popup:** erscheint beim Öffnen der App, bis die Person „Gelesen“ bestätigt; danach nicht erneut.
  Normale News gelten beim Ansehen der Newsseite als gelesen.
- Optional Push (Kategorie „News“ bzw. „Wichtige News“, siehe Einstellungen → Push-Benachrichtigungen).

## Vereinsumfragen

Frage, 2–10 Antworten, eine oder mehrere Antworten, Laufzeit (max. 1 Jahr), Zielgruppe wie bei News, optional anonym.
Stimmen sind nie direkt lesbar; Ergebnisse als Anzahl für alle Empfänger, Namen je Antwort nur für Verfasser/Vereinsadmin
und nur bei nicht-anonymen Umfragen. Abstimmen/Ändern bis zum Ende; Verantwortliche können beenden oder löschen.

## TanzRaum-Ankündigungen (Plattform-Administration)

- Administration → **Ankündigungen**: Titel, Text, Art (Information, Wartungsarbeiten, Neuheit), optional **Bild**
  (z. B. CD-/Bundle-Cover, JPG/PNG/WebP bis 5 MB, Bucket `ankuendigungen`, öffentlich lesbar, Upload nur Plattform-Admins)
  und **Link-Button** (nur https, z. B. Shop-Seite), Zeitraum (sichtbar ab/bis), Zielgruppe (alle, Vereinsadmins/Trainer/
  Betreuer, nur Konten ab 16), optional Popup und Push.
- Erscheinen auf allen Dashboards der Zielgruppe – unabhängig von Verein und Tarif. Nutzer können sie ausblenden
  (gespeichert als gelesen); wichtige erscheinen als Popup, bis sie bestätigt sind.

## Datenbank

`news`, `news_empfaenger`, `vereinsumfragen`, `vereinsumfrage_empfaenger`, `vereinsumfrage_stimmen`,
`plattform_ankuendigungen`, `plattform_ankuendigung_gelesen`, `vereine.news_rollen`.
Push: Edge Function `chat-push` mit `news_id` bzw. `ankuendigung_id`; Vorschau über `/api/chat/push-info`.
