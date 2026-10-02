-- TanzRaum Team, Freischaltungen (MANUAL_FREE/TEAM_FREE), Navigation, Workshops, Treff, Wissen (Rollback-Test).
-- Eine Transaktion, endet mit raise exception 'ERGEBNIS:...' -> alles wird zurueckgerollt. auth.users bleibt unberuehrt.
do $$
declare
  uA uuid := gen_random_uuid();  -- TanzRaum-Admin
  uF uuid := gen_random_uuid();  -- FREE
  uF2 uuid := gen_random_uuid(); -- FREE (Leser)
  uB uuid := gen_random_uuid();  -- BASIC
  uB2 uuid := gen_random_uuid(); -- BASIC
  uK uuid := gen_random_uuid();  -- Kind (14) mit BASIC
  uVA uuid := gen_random_uuid(); -- Vereinsadmin (Vereinslizenz)
  uT1 uuid := gen_random_uuid(); -- Team: nur Workshops
  uT2 uuid := gen_random_uuid(); -- Team: alle Rechte
  uT3 uuid := gen_random_uuid(); -- Team: Treff schliessen/oeffnen
  v uuid := gen_random_uuid();
  admin_r uuid := 'd8b4d77d-b91a-4b3d-9260-2c29ee7c09f9';
  r text := ''; t text; n int; b boolean; j jsonb; w uuid; th uuid; bt uuid; kat uuid; art uuid; abo uuid;
begin
  alter table vereins_mitglieder drop constraint vereins_mitglieder_user_id_fkey, drop constraint vereins_mitglieder_hinzugefuegt_von_fkey;
  alter table benachrichtigungen drop constraint benachrichtigungen_user_id_fkey;
  alter table profiles drop constraint profiles_id_fkey;
  grant execute on function public.tarif_von(uuid) to authenticated; -- nur fuer die Auswertung im Test (wird zurueckgerollt)
  insert into profiles (id, vorname, nachname, handle, geschlecht, geburtsdatum, tarif, tarif_aktiv_bis, verein_angabe) values
    (uA, 'Ada', 'Admin', 'ada_admin', 'w', '1985-01-01', 'free', null, null),
    (uF, 'Fiona', 'Frei', 'fiona', 'w', '1990-01-01', 'free', null, null),
    (uF2, 'Felix', 'Frei', 'felix', 'm', '1991-01-01', 'free', null, null),
    (uB, 'Bea', 'Basic', 'bea', 'w', '1992-01-01', 'basic', now() + interval '1 year', 'TSV Freizeit'),
    (uB2, 'Lisa', 'Basic', 'lisa', 'w', '1993-01-01', 'basic', now() + interval '1 year', null),
    (uK, 'Kim', 'Kind', 'kim', 'w', (current_date - interval '14 years')::date, 'basic', now() + interval '1 year', null),
    (uVA, 'Vera', 'Verein', 'vera', 'w', '1980-01-01', 'free', null, null),
    (uT1, 'Tim', 'Team', 'tim', 'm', '1988-01-01', 'free', null, null),
    (uT2, 'Tara', 'Team', 'tara', 'w', '1987-01-01', 'free', null, null),
    (uT3, 'Theo', 'Team', 'theo', 'm', '1986-01-01', 'free', null, null);
  update profiles set ist_plattform_admin = true where id = uA;
  insert into vereine (id, name, tarif, tarif_aktiv_bis) values (v, 'Cannstatter Quellenclub Test', 'verein', null);
  insert into vereins_mitglieder (user_id, verein_id, rolle_id) values (uVA, v, admin_r);

  set local role authenticated;

  -- ===================== Team & Rechte =====================
  perform set_config('request.jwt.claims', json_build_object('sub', uVA, 'role', 'authenticated')::text, true);
  begin perform admin_team_setzen(uT1, false, true, false, array['workshops'], false, null, null); r := r || 'T1 FEHLER Vereinsadmin setzt Team; ';
  exception when others then r := r || 'T1 Vereinsadmin kein Teamrecht; '; end;
  r := r || 'T2 Vereinsadmin team_darf(treff.themen_loeschen)=' || team_darf('treff.themen_loeschen') || '; ';

  perform set_config('request.jwt.claims', json_build_object('sub', uA, 'role', 'authenticated')::text, true);
  perform admin_team_setzen(uT1, false, true, false, array['workshops', 'workshops.ansehen', 'workshops.freigeben', 'workshops.ablehnen', 'treff.themen_loeschen', 'gibtsnicht'], true, null, 'Workshop-Team');
  perform admin_team_setzen(uT2, true, true, true, array[]::text[], false, null, null);
  perform admin_team_setzen(uT3, true, true, false, array['treff', 'treff.themen_schliessen', 'treff.themen_oeffnen'], false, null, null);
  select array_to_string(rechte, ',') into t from team_mitglieder where user_id = uT1;
  r := r || 'T3 T1 Rechte (Aktion ohne Bereich verworfen)=' || t || '; ';
  r := r || 'T4 T1 TEAM_FREE Tarif=' || tarif_von(uT1) || '; ';
  select count(*) into n from admin_protokoll where ziel_user_id = uT1 and aktion in ('team_hinzugefuegt', 'team_basic_freigeschaltet');
  r := r || 'T5 Protokoll=' || n || '; ';

  perform set_config('request.jwt.claims', json_build_object('sub', uT1, 'role', 'authenticated')::text, true);
  r := r || 'T6 T1 workshops.freigeben=' || team_darf('workshops.freigeben') || ' treff.themen_loeschen=' || team_darf('treff.themen_loeschen') || '; ';
  begin perform admin_team_setzen(uT1, true, true, true, array[]::text[], true, null, null); r := r || 'T7 FEHLER Team erweitert eigene Rechte; ';
  exception when others then r := r || 'T7 Team kann eigene Rechte nicht erweitern; '; end;
  begin perform admin_team_setzen(uF, false, true, false, array['workshops'], false, null, null); r := r || 'T8 FEHLER Team fuegt Teammitglied hinzu; ';
  exception when others then r := r || 'T8 Team fuegt niemanden hinzu; '; end;
  perform set_config('request.jwt.claims', json_build_object('sub', uT2, 'role', 'authenticated')::text, true);
  r := r || 'T9 alle Rechte: treff.nutzer_sperren=' || team_darf('treff.nutzer_sperren') || ', Admin-Funktion: ';
  begin perform admin_freischalten(uF, 'basic', 'kostenlos', null, null); r := r || 'FEHLER; ';
  exception when others then r := r || 'gesperrt; '; end;
  begin perform team_konto_sperren(uA, true, 'x'); r := r || 'T10 FEHLER Admin gesperrt; ';
  exception when others then r := r || 'T10 Admin nicht sperrbar; '; end;
  begin perform team_konto_sperren(uT1, true, 'x'); r := r || 'T11 FEHLER Team sperrt Team; ';
  exception when others then r := r || 'T11 Teammitglied nur durch Admin sperrbar; '; end;
  select (meine_team_rechte()->>'team')::boolean into b; r := r || 'T12 meine_team_rechte.team=' || b || '; ';

  -- ===================== Freischaltungen =====================
  perform set_config('request.jwt.claims', json_build_object('sub', uA, 'role', 'authenticated')::text, true);
  perform admin_freischalten(uF, 'basic', 'kostenlos', null, 'Pilotnutzerin');
  reset role;
  select abo_lizenzart(a) into t from abos a where a.user_id = uF and abo_gilt(a) limit 1;
  r := r || 'L1 FREE->BASIC unbefristet: ' || tarif_von(uF) || '/' || t || '; ';
  r := r || 'L2 kein Team=' || (not exists (select 1 from team_mitglieder where user_id = uF))::text || ', Kennzeichen=' || coalesce((select count(*)::text from team_kennzeichen(array[uF])), '0') || '; ';
  set local role authenticated;
  perform admin_freischalten(uF2, 'basic', 'kostenlos', current_date + 2, null);
  reset role;
  select a.id into abo from abos a where a.user_id = uF2 and abo_gilt(a) limit 1;
  r := r || 'L3 befristet: ' || tarif_von(uF2) || ' bis ' || (select to_char(tarif_aktiv_bis at time zone 'Europe/Berlin', 'YYYY-MM-DD') from profiles where id = uF2) || '; ';
  update abos set laeuft_bis = now() - interval '1 minute' where id = abo;
  perform abos_ablaufen();
  r := r || 'L4 nach Ablauf: ' || tarif_von(uF2) || ' (Konto bleibt: ' || (exists (select 1 from profiles where id = uF2))::text || '); ';
  set local role authenticated;
  -- MANUAL_FREE deaktivieren
  reset role;
  select a.id into abo from abos a where a.user_id = uF and abo_gilt(a) limit 1;
  set local role authenticated;
  perform admin_freischaltung_beenden(abo);
  r := r || 'L5 deaktiviert: ' || tarif_von(uF) || '; ';
  -- TEAM_FREE bleibt bei normaler Freischaltung „FREE“ unberuehrt
  perform admin_freischalten(uT1, 'free', 'kostenlos', null, null);
  r := r || 'L6 Team-BASIC bleibt bei FREE-Freischaltung: ' || tarif_von(uT1) || '; ';
  -- Team entfernen ohne BASIC
  perform admin_team_entfernen(uT1, false);
  r := r || 'L7 Team entfernt: Team=' || (exists (select 1 from team_mitglieder where user_id = uT1))::text || ' Tarif=' || tarif_von(uT1) || '; ';
  -- Team entfernen mit BASIC behalten
  perform admin_team_setzen(uT1, false, true, false, array['workshops', 'workshops.ansehen', 'workshops.freigeben', 'workshops.ablehnen'], true, null, null);
  perform admin_team_entfernen(uT1, true);
  r := r || 'L8 Team entfernt, BASIC behalten: ' || tarif_von(uT1) || '; ';
  perform admin_team_setzen(uT1, false, true, false, array['workshops', 'workshops.ansehen', 'workshops.freigeben', 'workshops.ablehnen'], false, null, null);
  -- VEREIN ohne Verein
  begin perform admin_freischalten(uB2, 'verein', 'kostenlos', null, null); r := r || 'L9 FEHLER VEREIN ohne Verein; ';
  exception when others then r := r || 'L9 VEREIN braucht Verein; '; end;
  select count(*) into n from admin_lizenzen(null) where user_id in (uF, uT1);
  r := r || 'L10 Lizenzuebersicht=' || n || '; ';

  -- ===================== Navigation =====================
  perform admin_navigation_tarife_setzen('{"/dashboard/spotlight": ["basic", "verein"], "/dashboard/workshops": ["free", "basic", "verein"]}');
  begin perform admin_navigation_tarife_setzen('{"/dashboard/x": ["gold"]}'); r := r || 'N1 FEHLER ungueltiger Tarif; ';
  exception when others then r := r || 'N1 ungueltig abgelehnt; '; end;
  perform admin_navigation_ausblenden(array['/dashboard/admin/statistik', '/dashboard/einstellungen', 'javascript:x']);
  r := r || 'N2 ausgeblendet=' || array_to_string(meine_navigation_ausgeblendet(), ',') || '; ';
  perform set_config('request.jwt.claims', json_build_object('sub', uF, 'role', 'authenticated')::text, true);
  begin perform admin_navigation_tarife_setzen('{}'); r := r || 'N3 FEHLER Nutzer setzt Navigation; ';
  exception when others then r := r || 'N3 Nutzer darf nicht; '; end;
  r := r || 'N4 Nutzer ausgeblendet=' || coalesce(array_to_string(meine_navigation_ausgeblendet(), ','), 'NULL') || '; ';

  -- ===================== Workshops =====================
  perform set_config('request.jwt.claims', json_build_object('sub', uF, 'role', 'authenticated')::text, true);
  w := workshop_einreichen(jsonb_build_object('titel', 'Gardetanz Technik', 'datum', current_date + 20, 'ausrichter', 'TSV Test',
        'ort', 'Mannheim', 'bundesland', 'Baden-Württemberg', 'beschreibung', 'Ein Tag voller Technik für Garden.'), false, false);
  r := r || 'W1 Status=' || (select status from workshops where id = w) || '; ';
  begin perform workshop_einreichen(jsonb_build_object('titel', 'X', 'datum', current_date, 'ausrichter', 'TSV', 'ort', 'Ort',
        'bundesland', 'Bundesland: Baden-Württemberg', 'beschreibung', 'Beschreibung lang genug'), false, false); r := r || 'W2 FEHLER Bundesland; ';
  exception when others then r := r || 'W2 Bundesland nur Auswahl; '; end;
  begin perform workshop_einreichen('{}'::jsonb, false, true); r := r || 'W3 FEHLER direkt freigeben; ';
  exception when others then r := r || 'W3 FREE darf nicht direkt freigeben; '; end;
  perform set_config('request.jwt.claims', json_build_object('sub', uF2, 'role', 'authenticated')::text, true);
  select count(*) into n from workshops where id = w; r := r || 'W4 andere sehen Eingereichtes=' || n || '; ';
  perform set_config('request.jwt.claims', json_build_object('sub', uK, 'role', 'authenticated')::text, true);
  begin perform workshop_einreichen(jsonb_build_object('titel', 'Kinder', 'datum', current_date, 'ausrichter', 'TSV', 'ort', 'Ort',
        'bundesland', 'Bayern', 'beschreibung', 'Beschreibung lang genug'), false, false); r := r || 'W5 FEHLER Kind reicht ein; ';
  exception when others then r := r || 'W5 Kind reicht nicht ein; '; end;
  perform set_config('request.jwt.claims', json_build_object('sub', uVA, 'role', 'authenticated')::text, true);
  begin perform workshop_status_setzen(w, 'freigegeben', null); r := r || 'W6 FEHLER Vereinsadmin gibt frei; ';
  exception when others then r := r || 'W6 Vereinsadmin gibt nicht frei; '; end;
  perform set_config('request.jwt.claims', json_build_object('sub', uT1, 'role', 'authenticated')::text, true);
  select count(*) into n from workshops_pruefen(); r := r || 'W7 Pruefliste T1=' || n || '; ';
  perform workshop_status_setzen(w, 'freigegeben', null);
  begin perform workshop_loeschen(w); r := r || 'W8 FEHLER T1 loescht ohne Recht; ';
  exception when others then r := r || 'W8 T1 ohne Loeschrecht; '; end;
  perform set_config('request.jwt.claims', json_build_object('sub', uF2, 'role', 'authenticated')::text, true);
  select count(*) into n from workshops where id = w; r := r || 'W9 nach Freigabe sichtbar=' || n || '; ';
  reset role;
  select count(*) into n from benachrichtigungen where user_id = uF and typ = 'workshop_freigegeben' and link like '/dashboard/workshops/%';
  r := r || 'W10 Benachrichtigung=' || n || '; ';
  update workshops set datum = current_date - 3 where id = w;
  select count(*) into n from workshops where id = w and coalesce(datum_bis, datum) < current_date;
  r := r || 'W11 vergangen, nicht geloescht=' || n || '; ';
  set local role authenticated;

  -- ===================== Treff =====================
  select id into kat from treff_kategorien where name = 'Tanz & Training';
  perform set_config('request.jwt.claims', json_build_object('sub', uF, 'role', 'authenticated')::text, true);
  begin perform treff_thema_erstellen(kat, 'Frage von FREE', 'Darf ich schreiben?'); r := r || 'R1 FEHLER FREE erstellt; ';
  exception when others then r := r || 'R1 FREE: ' || sqlerrm || '; '; end;
  perform set_config('request.jwt.claims', json_build_object('sub', uK, 'role', 'authenticated')::text, true);
  begin perform treff_thema_erstellen(kat, 'Frage vom Kind', 'Hallo zusammen'); r := r || 'R2 FEHLER Kind schreibt; ';
  exception when others then r := r || 'R2 Kind unter 16 schreibt nicht; '; end;
  perform set_config('request.jwt.claims', json_build_object('sub', uB, 'role', 'authenticated')::text, true);
  th := treff_thema_erstellen(kat, 'Welche Übungen helfen bei Sprungkraft?', 'Ich suche gute Übungen für mehr Sprungkraft im Gardetanz.');
  perform set_config('request.jwt.claims', json_build_object('sub', uVA, 'role', 'authenticated')::text, true);
  bt := treff_antworten(th, 'Kniebeugen und Seilspringen helfen sehr!');
  r := r || 'R3 Vereinsadmin (VEREIN) antwortet=' || (bt is not null) || '; ';
  select count(*) into n from treff_aehnliche('Sprungkraft Übungen Training'); r := r || 'R4 aehnliche=' || n || '; ';
  begin perform treff_beitrag_loeschen((select id from treff_beitraege where thema_id = th and autor_id = uVA)); r := r || 'R5 eigene Antwort geloescht; ';
  exception when others then r := r || 'R5 FEHLER eigene Antwort; '; end;
  bt := treff_antworten(th, 'Kniebeugen und Seilspringen helfen sehr!');
  begin perform treff_moderieren(th, 'schliessen'); r := r || 'R6 FEHLER Vereinsadmin moderiert; ';
  exception when others then r := r || 'R6 Vereinsadmin moderiert nicht; '; end;
  begin perform treff_thema_loeschen(th); r := r || 'R7 FEHLER Vereinsadmin loescht fremdes Thema; ';
  exception when others then r := r || 'R7 Vereinsadmin loescht nicht; '; end;
  reset role;
  select count(*) into n from benachrichtigungen where user_id = uB and typ = 'treff_antwort'; r := r || 'R8 Folgende benachrichtigt=' || n || '; ';
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', uF, 'role', 'authenticated')::text, true);
  j := treff_thema(th); r := r || 'R9 FREE liest: Beitraege=' || jsonb_array_length(j->'beitraege') || ' darf_schreiben=' || (j->>'darf_schreiben') || '; ';
  perform treff_melden('beitrag', bt, 'werbung', 'Das ist Werbung');
  r := r || 'R10 FREE meldet; ';
  begin perform treff_hilfreich_setzen(bt, true); r := r || 'R11 FEHLER FREE hilfreich; ';
  exception when others then r := r || 'R11 FREE nicht hilfreich; '; end;
  perform set_config('request.jwt.claims', json_build_object('sub', uB, 'role', 'authenticated')::text, true);
  r := r || 'R12 hilfreich=' || treff_hilfreich_setzen(bt, true) || '; ';
  perform treff_beste_antwort(th, bt);
  -- Team mit Schliessen-Recht, aber ohne Loeschrecht
  perform set_config('request.jwt.claims', json_build_object('sub', uT3, 'role', 'authenticated')::text, true);
  perform treff_moderieren(th, 'schliessen');
  begin perform treff_beitrag_loeschen(bt); r := r || 'R13 FEHLER T3 loescht; ';
  exception when others then r := r || 'R13 T3 nur zugewiesene Aktionen; '; end;
  begin perform treff_meldungen(null); r := r || 'R14 FEHLER T3 sieht Meldungen; ';
  exception when others then r := r || 'R14 T3 ohne Meldungsrecht; '; end;
  perform set_config('request.jwt.claims', json_build_object('sub', uT1, 'role', 'authenticated')::text, true);
  begin perform treff_moderieren(th, 'oeffnen'); r := r || 'R15 FEHLER Workshop-Team moderiert Treff; ';
  exception when others then r := r || 'R15 Workshop-Team moderiert Treff nicht; '; end;
  perform set_config('request.jwt.claims', json_build_object('sub', uB2, 'role', 'authenticated')::text, true);
  begin perform treff_antworten(th, 'Noch eine Antwort'); r := r || 'R16 FEHLER Antwort auf geschlossenes Thema; ';
  exception when others then r := r || 'R16 geschlossen: ' || sqlerrm || '; '; end;
  -- Admin: Meldung bearbeiten, Nutzer sperren, empfehlen
  perform set_config('request.jwt.claims', json_build_object('sub', uA, 'role', 'authenticated')::text, true);
  select count(*) into n from treff_meldungen('offen'); r := r || 'R17 Admin Treff-Meldungen=' || n || '; ';
  perform treff_meldung_setzen((select id from treff_meldungen('offen') limit 1), 'keine_massnahme', 'ok');
  perform treff_moderieren(th, 'oeffnen');
  perform treff_empfehlen(null, bt, true);
  perform treff_nutzer_sperren(uB2, null, 'Spam');
  perform set_config('request.jwt.claims', json_build_object('sub', uB2, 'role', 'authenticated')::text, true);
  begin perform treff_antworten(th, 'Ich bin gesperrt'); r := r || 'R18 FEHLER gesperrt schreibt; ';
  exception when others then r := r || 'R18 Treff-Sperre greift; '; end;
  j := treff_thema(th); r := r || 'R19 Gesperrte liest weiter=' || (j is not null) || '; ';
  reset role;
  select count(*) into n from benachrichtigungen where user_id = uF and typ = 'meldung_status'; r := r || 'R20 Melder informiert=' || n || '; ';
  select (x->>'empfohlen') into t from jsonb_array_elements((select treff_thema(th))->'beitraege') x limit 1;
  r := r || 'R20b empfohlen=' || t || '; ';
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', uF, 'role', 'authenticated')::text, true);
  j := treff_thema(th);
  r := r || 'R21 Autor-Anzeige=' || (j->'autor'->>'handle') || '/' || coalesce(j->'autor'->>'verein', '-') || ' Kennzeichen VA=' ||
       coalesce((select x->'autor'->>'kennzeichen' from jsonb_array_elements(j->'beitraege') x limit 1), 'keins') || '; ';
  perform set_config('request.jwt.claims', json_build_object('sub', uA, 'role', 'authenticated')::text, true);
  select count(*) into n from treff_themen_liste(null, 'aktuell', null, 10, 0); r := r || 'R22 Aktuell diskutiert=' || n || '; ';
  select count(*) into n from treff_themen_liste(null, 'neu', 'Sprungkraft', 10, 0); r := r || 'R23 Suche=' || n || '; ';
  -- Nutzer entfernen (Team mit allen Rechten)
  perform set_config('request.jwt.claims', json_build_object('sub', uT2, 'role', 'authenticated')::text, true);
  j := treff_nutzer_entfernen(uVA, 'Test');
  r := r || 'R24 entfernt=' || j::text || '; ';

  -- ===================== Wissen =====================
  perform set_config('request.jwt.claims', json_build_object('sub', uT3, 'role', 'authenticated')::text, true);
  begin perform wissen_speichern(null, jsonb_build_object('titel', 'Sprungkraft', 'inhalt', 'Inhalt lang genug')); r := r || 'K1 FEHLER T3 erstellt Wissen; ';
  exception when others then r := r || 'K1 T3 ohne Wissensrecht; '; end;
  perform set_config('request.jwt.claims', json_build_object('sub', uA, 'role', 'authenticated')::text, true);
  art := wissen_speichern(null, jsonb_build_object('titel', 'Sprungkrafttraining im karnevalistischen Tanzsport', 'kategorie_id', kat,
          'einleitung', 'Was wirklich hilft.', 'inhalt', 'Kniebeugen, Seilspringen und Plyometrie.', 'treff_thema_id', th));
  perform set_config('request.jwt.claims', json_build_object('sub', uF, 'role', 'authenticated')::text, true);
  select count(*) into n from wissen_artikel where id = art; r := r || 'K2 Entwurf fuer FREE sichtbar=' || n || '; ';
  perform set_config('request.jwt.claims', json_build_object('sub', uA, 'role', 'authenticated')::text, true);
  perform wissen_veroeffentlichen(art, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uF, 'role', 'authenticated')::text, true);
  select count(*) into n from wissen_artikel where id = art and treff_thema_id = th; r := r || 'K3 veroeffentlicht + Diskussion verknuepft=' || n || '; ';
  r := r || 'K4 Treff-Thema bleibt=' || (exists (select 1 from treff_themen where id = th))::text || '; ';

  reset role;
  select count(*) into n from admin_protokoll where erstellt_am > now() - interval '1 minute';
  r := r || 'P1 Protokolleintraege=' || n || '; ';
  raise exception 'ERGEBNIS:%', r;
end $$;
