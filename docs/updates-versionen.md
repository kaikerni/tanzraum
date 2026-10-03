# Updates, Versionen und Release-Informationen

TanzRaum ist eine **Web-App** (https://tanzraum.app). Neue Versionen werden zentral auf dem Server eingespielt;
Nutzer laden beim nächsten Öffnen bzw. Aktualisieren automatisch die aktuelle Version. Es gibt **keinen** Download,
keine Neuinstallation und keine ISO/ZIP für Vereinsmitglieder – ISO/ZIP dienen ausschließlich dem Deployment auf dem Server.

## Wo wird die Version definiert?

| Was | Wo | Beispiel |
|---|---|---|
| Versionsnummer (Semver, manuell) | `package.json` → `"version"` | `1.0.0`, `1.1.0`, `1.1.1` |
| Build (Commit) | beim Bauen: Umgebungsvariable `TANZRAUM_BUILD`, sonst `git rev-parse --short HEAD` | `9f0dde4` |
| Build-Kennung (eindeutig je Build) | `next.config.mjs` (`generateBuildId`) = Build + Zeitstempel | `9f0dde4-mg8x2k1` |

`next.config.mjs` stellt die Werte als `NEXT_PUBLIC_TANZRAUM_VERSION`, `…_BUILD`, `…_BUILD_ID` bereit;
gelesen werden sie über `src/lib/version`. Angezeigt: Benutzermenü (oben rechts), „Was ist neu?“, `/neu`,
Administration. Abfrage: `GET /api/version` → `{ "version": "1.0.0", "build": "9f0dde4", "buildId": "…" }` (öffentlich,
nie zwischengespeichert).

## Wo werden Release-Informationen gespeichert?

In der bestehenden Tabelle `plattform_ankuendigungen` (TanzRaum-Ankündigungen) mit `art = 'neuheit'` und den Feldern
`version`, `kategorie` (neue_funktion / verbesserung / fehlerbehebung / hinweis), `kurztext`, `text`, `sichtbar_ab`
(Datum), `auf_landingpage`, `im_benutzerbereich`, `wichtig`, `kai_hinweis`, `bild_pfad`, `link_url` (Buttonziel),
`link_text` (Buttontext). Schreiben dürfen nur Plattform-Admins (RLS).

- **Landingpage** („✨ Neu bei TanzRaum“, `/` und `/neu`): Funktion `tanzraum_neuigkeiten_oeffentlich()` – nur
  `auf_landingpage`, Zielgruppe „alle“, aktuell sichtbar; ohne Anmeldung lesbar, nur öffentliche Felder. Ohne Einträge
  erscheint der Bereich nicht.
- **Eingeloggter Bereich**: Dashboard-Hinweis (Leiste, ausblendbar, kein Popup) und Seite **„Was ist neu?“**
  (`/dashboard/neu`, auch im Benutzermenü) – über `meine_ankuendigungen()`, nur `im_benutzerbereich`.
- **Kai**: Einträge mit `kai_hinweis` erscheinen in Kais „Neu in TanzRaum“ und als „✨ Neu bei TanzRaum: … Soll ich dir
  zeigen, wie es funktioniert?“ mit Link zur Funktion. Kai zeigt nur einen roten Punkt, öffnet sich nie selbst und
  verändert nichts.

## Wo verwaltet die TanzRaum-Administration Updates?

Administration → **Updates & Neuigkeiten** (`/dashboard/admin/updates`): „+ Update erstellen“ mit Version, Titel,
Kurzbeschreibung, Beschreibung, Datum, Kategorie, Landingpage, Benutzerbereich, Wichtig, Kai-Hinweis, optional Bild,
Buttonziel (Pfad wie `/dashboard/verein` oder https-Link) und Buttontext. Bestehende Einträge: Schalter für Landingpage,
Benutzerbereich, Wichtig, Kai-Hinweis sowie Beenden/Löschen. Nur relevante Funktionen eintragen, keine rein technischen
Änderungen.

## Wie wird ein neues Release veröffentlicht?

1. Version in `package.json` erhöhen (z. B. `1.1.0`) und committen.
2. Bauen mit Build-Kennung: `TANZRAUM_BUILD=$(git rev-parse --short HEAD) npx next build`, Paket/ISO erstellen.
3. Auf dem Server einspielen (`einspielen.sh` bzw. `installieren.sh`). Am Ende zeigt das Skript Build und
   `/api/version` an.
4. Optional: unter „Updates & Neuigkeiten“ einen Eintrag für die neue Version anlegen.

## Wie aktualisiert sich die Web-App beim Nutzer?

- Seiten werden dynamisch vom Server erzeugt; die JavaScript-Dateien unter `/_next/static` tragen eindeutige
  Hash-Namen. Nach dem Einspielen lädt der nächste Seitenaufruf automatisch die neue Version.
- Ist TanzRaum bei jemandem schon länger offen, prüft die App alle 10 Minuten und beim Zurückkehren in den Tab
  `/api/version`. Läuft ein neuer Build, erscheint unten ein dezenter Hinweis „Eine neue TanzRaum-Version ist da“
  mit „Neu laden“ und „Was ist neu?“ (schließbar, kein Popup, blockiert nichts).
- Nach dem Laden einer neuen Versionsnummer zeigt die App einmal je Gerät „TanzRaum wurde aktualisiert (Version …)“.

## Wie funktioniert der Cache?

- **Service Worker** `/sw.js`: nur für Push-Benachrichtigungen, **kein Seiten- oder Datei-Cache** (kein fetch-Handler).
  `skipWaiting` + `clients.claim`, damit ein neuer Worker sofort übernimmt.
- `/service-worker.js`: Abschalt-Worker für einen alten Worker eines früheren Web-Auftritts (leert dessen Caches,
  meldet sich ab); `ServiceWorkerAufraeumen` meldet fremde Worker zusätzlich im Browser ab.
- HTTP: `/sw.js`, `/service-worker.js` und `/api/version` mit `Cache-Control: no-cache, no-store, must-revalidate`,
  Manifest mit `no-cache` (`next.config.mjs`). `/_next/static` darf dauerhaft gecacht werden (Hash im Namen).
- Es gibt keine Cache-Logik, die Nutzer auf einer alten Version festhält.
