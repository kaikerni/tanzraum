# Fahrgemeinschaften

Nur mit Vereinslizenz, immer vereinsintern. Migration `20260930000058_fahrgemeinschaften`.

## Wer darf was?

- Jedes aktive, aufgenommene Mitglied eines Vereins mit gültiger Vereinslizenz (Bereich nicht ausgeschaltet):
  Fahrt anbieten („Ich fahre … – 3 Plätze frei“) oder Mitfahrt suchen, auf jede Fahrt reagieren
  (mitfahren mit Personenzahl, „Ich kann mitnehmen“, Nachricht). Keine Einschränkung auf Admin/Trainer/Betreuer,
  die Rollen-Einstellung in der Vereinsverwaltung gilt für diesen Bereich nicht.
- Wer eine Fahrt eingetragen hat: bearbeiten, als voll/gefunden markieren, wieder öffnen, absagen, löschen,
  Einträge anderer auf der eigenen Fahrt entfernen.
- Andere Vereine, FREE/BASIC ohne Verein, Vereine ohne Lizenz: kein Zugriff (Hinweisseite).
- TanzRaum-Administration und Fernwartung: kein Zugriff auf Inhalte (keine Ausnahme in RLS/RPCs).
- Kinder unter 16 mit Nachrichtensperre der Eltern: nur lesen; Eltern tragen sie ein.

## Technik

- Tabellen `fahrgemeinschaften`, `fahrgemeinschaft_antworten`; RLS nur Lesen über `fahrgemeinschaft_zugang(verein_id)`,
  Schreiben ausschließlich über RPCs (`fahrgemeinschaft_speichern`, `_reagieren`, `_status_setzen`, `_loeschen`,
  `_reaktion_entfernen`), Seite über `fahrgemeinschaften_uebersicht(p_vergangene)`.
- Plätze werden geprüft (keine Überbuchung); Einträge ausgetretener Mitglieder werden ausgeblendet.
- Benachrichtigungen (`benachrichtigungen.typ = 'fahrgemeinschaft'`) an Anbietende bei Reaktionen, an Eingetragene bei
  Änderung von Datum/Uhrzeit/Treffpunkt, Absage oder Entfernen; Push über `chat-push` (`benachrichtigung_id`) in der
  Push-Kategorie „Fahrgemeinschaften“ (Standard an), Text über `/api/chat/push-info`.
- Datensparsamkeit: Cron `fahrgemeinschaften-aufraeumen` löscht Fahrten 30 Tage nach dem Fahrtdatum.
- Datenexport enthält eigene Fahrten und Reaktionen.
