# E-Mail-Versand (Brevo)

TanzRaum versendet **alle** E-Mails über **Brevo** (transaktionale API). Es gibt keine weitere Mail-Plattform.
Die IONOS-Postfächer (z. B. `info@tanzraum.app`) und die DNS-Einträge bleiben unverändert.

| | |
|---|---|
| Absender | `TanzRaum <noreply@tanzraum.app>` – fest im Server-Code, vom Browser nicht änderbar |
| Antworten / Support | `info@tanzraum.app` (Reply-To und Kontaktadresse in jeder E-Mail) |
| Brevo-Zugang | nur Supabase Secret `BREVO_API_KEY` (API-Schlüssel `xkeysib-…`, **kein** SMTP-Schlüssel) |
| Domain | `tanzraum.app` bei Brevo per DKIM (`brevo1/brevo2._domainkey`) authentifiziert, DMARC vorhanden |

## Architektur

```
Supabase Auth ──(Send Email Hook, signiert)──► auth-email ──┐
App (Server Actions) ──(Nutzer-JWT)──► send-beitritt-einladung ├─► _shared/mail.ts ──► Brevo API
                                       vereinsrundschreiben-email│
                                       spendenbescheinigung-senden│
paypal-webhook ──(Secret Key)──► rechnung-versenden ────────────┘
```

- `supabase/functions/_shared/mail.ts` – fester Absender, einheitliches Layout (responsive, Logo, roter Button,
  Ersatzlink, Hinweisbox, Fußzeile), Versand über Brevo, neutrale Fehlermeldung, Logs nur mit Art + HTTP-Status.
- `supabase/functions/_shared/vorlagen.ts` – alle Texte und Betreffzeilen.
- `supabase/functions/_shared/zugriff.ts` – Anmeldung prüfen, Versandprotokoll, Ratenbegrenzung.

## Funktionen

| Funktion | Zweck | Wer darf? (serverseitig geprüft) | Grenzen |
|---|---|---|---|
| `auth-email` | Konto-E-Mails (Hook) | nur Supabase Auth (Standard-Webhooks-Signatur mit `SEND_EMAIL_HOOK_SECRET`) | – |
| `send-beitritt-einladung` | Vereins-/Gruppeneinladung | Vereinsadmin, Verein mit Lizenz, Einladung gültig (`mail_einladung_daten`) | 30/Std. pro Person, 10/Tag pro Einladung |
| `vereinsrundschreiben-email` | Rundschreiben | Vereinsadmin/Trainer mit Lizenz (`mail_darf_rundschreiben`); Empfänger nur aus der Mitgliederliste | 3/Tag pro Verein, max. 10.000 Zeichen |
| `spendenbescheinigung-senden` | Zuwendungsbestätigung | Vereinsadmin mit Lizenz (`mail_darf_spendenbescheinigung`); Empfänger = gespeicherte Spender-Adresse | 3/Tag pro Spende |
| `rechnung-versenden` | Rechnung nach Zahlung | `paypal-webhook` (Supabase Secret Key) oder Plattform-Admin | 3/Tag pro Rechnung |
| `send-email` | **stillgelegt** (war ein offenes Mail-Relay) | niemand – antwortet immer `410` | – |

Alle Funktionen: `verify_jwt` aus, eigene Prüfung im Code; Inhalte werden serverseitig erzeugt und HTML-escaped;
Fehler von Brevo werden nie an den Browser weitergegeben, sondern nur:
„Die E-Mail konnte momentan nicht versendet werden. Bitte versuche es später erneut.“

### Konto-E-Mails (`auth-email`)

| Supabase-Aktion | E-Mail | Button | Ziel nach Klick |
|---|---|---|---|
| `signup` | Willkommen bei TanzRaum – bitte E-Mail-Adresse bestätigen | E-Mail-Adresse bestätigen | Dashboard bzw. Einladung |
| `recovery` | TanzRaum – Passwort zurücksetzen | Passwort zurücksetzen | `/passwort-neu` |
| `email_change` | an **alte** und **neue** Adresse (sichere Änderung) | Änderung bestätigen | Einstellungen |
| `magiclink` / `email` | Anmeldelink | Bei TanzRaum anmelden | Dashboard |
| `invite` | Einladung zu TanzRaum | Einladung annehmen | Dashboard |
| `reauthentication` | Sicherheitscode | – | – |
| `*_notification` | Sicherheitsmeldung (Passwort/E-Mail/Telefon geändert, Anmeldemethode, 2FA) | Zu TanzRaum | – |

Alle Links führen zu `<App>/auth/bestaetigen?token_hash=…&type=…&weiter=…`. Die Seite bestätigt erst **nach einem
Klick** (Virenscanner und Link-Vorschauen können den Einmal-Link so nicht vorab verbrauchen). Supabase Auth prüft
Gültigkeit, Ablauf und Einmaligkeit. Alte `*.html`-Adressen werden nie verwendet.

Die App-Adresse kommt aus der von Supabase geprüften `redirect_to`-Adresse (Redirect-Allowlist), sonst aus dem
Secret `TANZRAUM_APP_URL` (Standard `https://tanzraum.app`).

## App-Seiten

| Seite | Zweck |
|---|---|
| `/login` | „Passwort vergessen?“, verständliche Fehlermeldungen, „Bestätigungs-E-Mail erneut senden“ |
| `/signup` | Registrierung; nach Bestätigung zurück zum Ziel (z. B. Einladung) |
| `/passwort-vergessen` | Link anfordern – Antwort immer gleich (verrät nicht, ob ein Konto existiert) |
| `/auth/bestaetigen` | Einlösen der E-Mail-Links; Fehlerseite für abgelaufene/benutzte Links |
| `/passwort-neu` | Neues Passwort + Wiederholung; nur in frischer Zurücksetzen-Sitzung (`ist_recovery_sitzung`); danach Abmeldung auf allen Geräten |
| `/dashboard/einstellungen` | E-Mail-Adresse ändern, Passwort ändern (aktuelles Passwort wird geprüft, andere Geräte werden abgemeldet) |
| `/dashboard/verein` | Einladung mit optionaler Gruppe erstellen und „Per E-Mail senden“ |

Passwörter verwaltet ausschließlich Supabase Auth; es werden nie Passwörter per E-Mail verschickt.

## Datenschutz

- Tabelle `mail_versand_log`: nur Art, Absender-Konto, Verein, Bezug, Anzahl, Erfolg, Zeit – **keine** Adressen,
  keine Inhalte. Kein Zugriff für Nutzer (RLS ohne Freigaben), Löschung nach 90 Tagen (pg_cron `mail-log-aufraeumen`).
- Rundschreiben: jede Person erhält eine eigene E-Mail (keine sichtbaren Empfängerlisten).
- In Logs stehen weder Tokens noch Adressen noch Brevo-Antworttexte.

## Brevo-Tarif

Der kostenlose Brevo-Tarif erlaubt **300 E-Mails pro Tag**. Konto-E-Mails, Einladungen, Rundschreiben, Rechnungen und
Spendenbescheinigungen teilen sich dieses Kontingent. Ein Rundschreiben an viele Mitglieder kann es an einem Tag
aufbrauchen – dann schlagen auch Passwort-Mails bis zum nächsten Tag fehl. Bei wachsender Nutzung lohnt ein Blick auf
den Verbrauch in Brevo.

## Selbsttest (ohne Geheimnisse, ohne echte Zustellung)

```sql
select net.http_post('https://oraiqjulxmohclfixwdq.supabase.co/functions/v1/auth-email', '{"selbsttest":true}'::jsonb, '{}'::jsonb,
  jsonb_build_object('Content-Type','application/json','x-tanzraum-geheimnis',
    (select decrypted_secret from vault.decrypted_secrets where name = 'chat_push_geheimnis')), 30000);
-- Ergebnis danach in net._http_response
```

Liefert: ob `BREVO_API_KEY` und `SEND_EMAIL_HOOK_SECRET` gesetzt sind, Art des Brevo-Schlüssels, Tarif/Guthaben,
Absender- und Domain-Status bei Brevo und einen Probeversand im Brevo-Sandbox-Modus (wird geprüft, aber nicht zugestellt).

## Alte Bestandteile (dokumentiert, nicht gelöscht)

- `send-email`: stillgelegt (410), bleibt als Platzhalter bestehen.
- Altes Einladungssystem der früheren Website (`invite_links`, `accept_invite`, `pruefe_invite_token`,
  Links auf `login.html?invite=`): wird von der neuen App nicht verwendet. Die neue App nutzt `einladungen`,
  `einladung_info`, `invite_einloesen`.
