-- TanzRaum Chat + TanzRaum Schutzpruefung (Rollback-Test, eine Transaktion, endet mit 'ERGEBNIS:...')
do $$
declare
  uA uuid := gen_random_uuid();  -- TanzRaum-Admin
  uF uuid := gen_random_uuid();  -- FREE
  uB uuid := gen_random_uuid();  -- BASIC
  uB2 uuid := gen_random_uuid(); -- BASIC
  uK uuid := gen_random_uuid();  -- Kind (14)
  uVA uuid := gen_random_uuid(); -- Vereinsadmin
  uM uuid := gen_random_uuid();  -- Moderatorin: oeffentlicher Chat
  v uuid := gen_random_uuid();
  admin_r uuid := 'd8b4d77d-b91a-4b3d-9260-2c29ee7c09f9';
  r text := ''; t text; n int; b boolean; j jsonb; tz uuid; g uuid; m uuid; fall uuid; i int;
begin
  alter table vereins_mitglieder drop constraint vereins_mitglieder_user_id_fkey, drop constraint vereins_mitglieder_hinzugefuegt_von_fkey;
  alter table benachrichtigungen drop constraint benachrichtigungen_user_id_fkey;
  alter table gespraech_teilnehmer drop constraint gespraech_teilnehmer_user_id_fkey;
  alter table nachrichten drop constraint nachrichten_sender_id_fkey;
  alter table profiles drop constraint profiles_id_fkey;
  insert into profiles (id, vorname, nachname, handle, geschlecht, geburtsdatum, tarif, tarif_aktiv_bis) values
    (uA, 'Ada', 'Admin', 'ada_admin', 'w', '1985-01-01', 'free', null),
    (uF, 'Fiona', 'Frei', 'fiona', 'w', '1990-01-01', 'free', null),
    (uB, 'Bea', 'Basic', 'bea', 'w', '1992-01-01', 'basic', now() + interval '1 year'),
    (uB2, 'Lisa', 'Basic', 'lisa', 'w', '1993-01-01', 'basic', now() + interval '1 year'),
    (uK, 'Kim', 'Kind', 'kim', 'w', (current_date - interval '14 years')::date, 'basic', now() + interval '1 year'),
    (uVA, 'Vera', 'Verein', 'vera', 'w', '1980-01-01', 'free', null),
    (uM, 'Mona', 'Moderation', 'mona', 'w', '1984-01-01', 'free', null);
  update profiles set ist_plattform_admin = true where id = uA;
  insert into vereine (id, name, tarif, tarif_aktiv_bis) values (v, 'Chatverein Test', 'verein', null);
  insert into vereins_mitglieder (user_id, verein_id, rolle_id) values (uVA, v, admin_r);
  select id into tz from gespraeche where typ = 'tanzraum';
  r := r || 'C0 tanzraum vorhanden=' || (tz is not null) || ' Standard aus=' || (not (select chat_aktiv from plattform_einstellungen where id))::text || '; ';

  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', uA, 'role', 'authenticated')::text, true); perform set_config('request.jwt.claim.sub', uA::text, true);
  perform admin_team_setzen(uM, true, true, false, array['chat', 'chat.oeffentlich_moderieren', 'chat.meldungen_bearbeiten', 'chat.nachrichten_loeschen'], false, null, null);
  -- Admin-Schalter: aus -> niemand (ausser Admin/Moderation); nur BASIC/VEREIN -> FREE nicht; danach fuer alle
  perform set_config('request.jwt.claims', json_build_object('sub', uF, 'role', 'authenticated')::text, true); perform set_config('request.jwt.claim.sub', uF::text, true);
  r := r || 'S1 aus: FREE=' || hat_gespraech_zugriff(tz);
  perform set_config('request.jwt.claims', json_build_object('sub', uM, 'role', 'authenticated')::text, true); perform set_config('request.jwt.claim.sub', uM::text, true);
  r := r || ' Moderation=' || hat_gespraech_zugriff(tz) || '; ';
  perform set_config('request.jwt.claims', json_build_object('sub', uB, 'role', 'authenticated')::text, true); perform set_config('request.jwt.claim.sub', uB::text, true);
  begin perform admin_chat_freigabe_setzen(true, array['free']); r := r || 'S2 FEHLER Nutzer schaltet Chat; ';
  exception when others then r := r || 'S2 Schalter nur Admin; '; end;
  perform set_config('request.jwt.claims', json_build_object('sub', uA, 'role', 'authenticated')::text, true); perform set_config('request.jwt.claim.sub', uA::text, true);
  perform admin_chat_freigabe_setzen(true, array['basic', 'verein']);
  perform set_config('request.jwt.claims', json_build_object('sub', uF, 'role', 'authenticated')::text, true); perform set_config('request.jwt.claim.sub', uF::text, true);
  r := r || 'S3 nur BASIC/VEREIN: FREE=' || hat_gespraech_zugriff(tz) || ' tanzraum_chat=' || coalesce(tanzraum_chat()::text, 'null');
  perform set_config('request.jwt.claims', json_build_object('sub', uB, 'role', 'authenticated')::text, true); perform set_config('request.jwt.claim.sub', uB::text, true);
  r := r || ' BASIC=' || hat_gespraech_zugriff(tz) || '; ';
  perform set_config('request.jwt.claims', json_build_object('sub', uA, 'role', 'authenticated')::text, true); perform set_config('request.jwt.claim.sub', uA::text, true);
  perform admin_chat_freigabe_setzen(true, array['free', 'basic', 'verein']);

  -- ===================== Zugriff oeffentlicher Chat =====================
  perform set_config('request.jwt.claims', json_build_object('sub', uF, 'role', 'authenticated')::text, true); perform set_config('request.jwt.claim.sub', uF::text, true);
  j := tanzraum_chat();
  r := r || 'C1 FREE liest=' || hat_gespraech_zugriff(tz) || ' schreibt=' || (j->>'darf_schreiben') || '; ';
  begin insert into nachrichten (gespraech_id, sender_id, inhalt) values (tz, uF, 'direkt'); r := r || 'C2 FEHLER direkt in oeffentlichen Chat; ';
  exception when others then r := r || 'C2 direktes Schreiben gesperrt; '; end;
  j := schutz_vorpruefung(tz, 'neu', null, 'Wer ist morgen beim Turnier?');
  r := r || 'C3 Vorpruefung FREE ok=' || (j->>'ok') || ' oeffentlich=' || (j->>'oeffentlich') || ' minderjaehrige=' || (j->>'minderjaehrige') || '; ';
  begin perform schutz_veroeffentlichen(uF, tz, 'neu', null, '{"inhalt":"x"}'); r := r || 'C4 FEHLER Nutzer veroeffentlicht selbst; ';
  exception when others then r := r || 'C4 Veroeffentlichen nur Service; '; end;
  begin perform schutz_blockieren(uF, tz, 'regel', 'blockiert', 'x', 1, null, null); r := r || 'C5 FEHLER Nutzer blockiert; ';
  exception when others then r := r || 'C5 Blockieren nur Service; '; end;
  reset role;
  perform schutz_veroeffentlichen(uF, tz, 'neu', null, '{"inhalt":"Wer ist morgen beim Turnier?"}');
  perform schutz_veroeffentlichen(uB, tz, 'neu', null, '{"inhalt":"Wir sind dabei!"}');
  begin perform schutz_veroeffentlichen(uB, tz, 'neu', null, '{"inhalt":"Bild","bild_pfad":"x/y.jpg"}'); r := r || 'C6 FEHLER Bild im oeffentlichen Chat; ';
  exception when others then r := r || 'C6 nur Text/Smileys; '; end;
  begin perform schutz_veroeffentlichen(uK, tz, 'neu', null, '{"inhalt":"Hallo"}'); r := r || 'C7 FEHLER Kind schreibt oeffentlich; ';
  exception when others then r := r || 'C7 unter 16 nur lesen; '; end;
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', uK, 'role', 'authenticated')::text, true); perform set_config('request.jwt.claim.sub', uK::text, true);
  select count(*) into n from chat_nachrichten(tz);
  r := r || 'C8 Kind liest=' || n || ' schreibt=' || (tanzraum_chat()->>'darf_schreiben') || '; ';
  perform set_config('request.jwt.claims', json_build_object('sub', uB2, 'role', 'authenticated')::text, true); perform set_config('request.jwt.claim.sub', uB2::text, true);
  select string_agg(coalesce(a.handle, '?'), ',' order by a.handle) into t from chat_absender(tz, array[uF, uB, uK]) a;
  r := r || 'C9 Absender (nur wer geschrieben hat)=' || coalesce(t, '-') || '; ';
  -- kein Push fuer den oeffentlichen Chat
  reset role;
  r := r || 'C10 Push-Ausschluss=' || (position('''tanzraum''' in pg_get_functiondef('public.chat_push_ziele(text,uuid)'::regprocedure)) > 0) || '; ';
  set local role authenticated;

  -- ===================== Vorpruefung: Duplikat, Flut, Sperre =====================
  perform set_config('request.jwt.claims', json_build_object('sub', uF, 'role', 'authenticated')::text, true); perform set_config('request.jwt.claim.sub', uF::text, true);
  r := r || 'D1 Duplikat=' || (schutz_vorpruefung(tz, 'neu', null, 'wer ist MORGEN beim Turnier??')->>'grund') || '; ';
  reset role;
  for i in 1..8 loop perform schutz_veroeffentlichen(uB2, tz, 'neu', null, jsonb_build_object('inhalt', 'Nachricht ' || i)); end loop;
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', uB2, 'role', 'authenticated')::text, true); perform set_config('request.jwt.claim.sub', uB2::text, true);
  r := r || 'D2 Flut=' || (schutz_vorpruefung(tz, 'neu', null, 'noch eine')->>'grund') || '; ';

  -- ===================== Abgestufte Massnahmen (nie Kontosperre) =====================
  reset role;
  j := schutz_blockieren(uF, tz, 'regel', 'blockiert', 'beleidigung', 1, 'h1', 'Auszug 1');
  r := r || 'M1 1. Verstoss=' || (j->>'massnahme') || '; ';
  j := schutz_blockieren(uF, tz, 'ki', 'blockiert', 'beleidigung', 1, 'h2', 'Auszug 2');
  r := r || 'M2 2. Verstoss=' || (j->>'massnahme') || ' Hinweis=' || (select count(*) from benachrichtigungen x where x.user_id = uF and x.typ = 'chat_hinweis') || '; ';
  j := schutz_blockieren(uF, tz, 'regel', 'blockiert', 'kontaktdaten', 1, 'h3', 'Auszug 3');
  r := r || 'M3 3. Verstoss=' || (j->>'massnahme') || ' Fall=' || (j->>'fall') || '; ';
  r := r || 'M4 Konto weiter offen=' || (not coalesce((select gesperrt from profiles where id = uF), false))::text || '; ';
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', uF, 'role', 'authenticated')::text, true); perform set_config('request.jwt.claim.sub', uF::text, true);
  r := r || 'M5 Vorpruefung gesperrt=' || (schutz_vorpruefung(tz, 'neu', null, 'Hallo')->>'grund') || ' darf_schreiben=' || darf_im_gespraech_schreiben(tz) || '; ';
  begin select count(*) into n from schutz_ereignisse; r := r || 'M6 FEHLER Nutzer liest Schutzereignisse; ';
  exception when insufficient_privilege then r := r || 'M6 Schutzereignisse fuer Nutzer gesperrt; '; end;
  reset role;
  j := schutz_blockieren(uB, tz, 'ki', 'blockiert', 'grooming', 3, 'h4', 'Auszug grooming');
  r := r || 'M7 schwerer Verstoss=' || (j->>'massnahme') || ' Fall=' || (j->>'fall') || '; ';
  j := schutz_blockieren(uB2, tz, 'ki_fehler', 'nicht_geprueft', 'ki_nicht_erreichbar', 0, 'h5', null);
  r := r || 'M8 KI-Ausfall ohne Massnahme=' || (j->>'massnahme') || '; ';
  select count(*) into n from schutz_ereignisse where text_hash is not null and kategorie is not null;
  r := r || 'M9 Ereignisse=' || n || ' ohne Text-Spalte=' || (not exists (select 1 from information_schema.columns where table_name = 'schutz_ereignisse' and column_name in ('text', 'inhalt')))::text || '; ';

  -- ===================== Melden + Moderation =====================
  set local role authenticated;
  select id into m from nachrichten where gespraech_id = tz and sender_id = uB limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', uB2, 'role', 'authenticated')::text, true); perform set_config('request.jwt.claim.sub', uB2::text, true);
  perform chat_nachricht_melden(m, 'beleidigung', 'unfreundlich');
  begin perform chat_nachricht_melden(m, 'beleidigung', null); r := r || 'R1 FEHLER doppelt gemeldet; ';
  exception when others then r := r || 'R1 nur einmal melden; '; end;
  begin perform chat_faelle(null); r := r || 'R2 FEHLER Nutzer sieht Faelle; ';
  exception when others then r := r || 'R2 Nutzer sieht keine Faelle; '; end;
  perform set_config('request.jwt.claims', json_build_object('sub', uVA, 'role', 'authenticated')::text, true); perform set_config('request.jwt.claim.sub', uVA::text, true);
  begin perform chat_faelle(null); r := r || 'R3 FEHLER Vereinsadmin moderiert; ';
  exception when others then r := r || 'R3 Vereinsadmin ohne Chat-Moderation; '; end;
  r := r || 'R3b Vereinsadmin loescht oeffentlich=' || ist_chat_leitung(tz) || '; ';
  perform set_config('request.jwt.claims', json_build_object('sub', uM, 'role', 'authenticated')::text, true); perform set_config('request.jwt.claim.sub', uM::text, true);
  select count(*) into n from chat_faelle(null);
  r := r || 'R4 Moderatorin sieht oeffentliche Faelle=' || n || ' Leitung oeffentlich=' || ist_chat_leitung(tz) || '; ';
  select f.id into fall from chat_faelle(null) f where f.nachricht_id = m;
  begin perform chat_fall_setzen(fall, 'erledigt', 'x', false, false, 2); r := r || 'R5 FEHLER Sperre ohne Recht; ';
  exception when others then r := r || 'R5 Schreibsperre nur mit Recht; '; end;
  perform chat_fall_setzen(fall, 'erledigt', 'Nachricht entfernt', true, true, 0);
  reset role;
  r := r || 'R6 Nachricht entfernt=' || ((select geloescht_am from nachrichten where id = m) is not null)
        || ' Auszug geleert=' || ((select auszug from meldungen where id = fall) is null)
        || ' Melderin informiert=' || exists (select 1 from benachrichtigungen x where x.user_id = uB2 and x.typ = 'meldung_status')
        || ' Protokoll=' || exists (select 1 from admin_protokoll p where p.aktion = 'chat_nachricht_entfernt') || '; ';
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', uA, 'role', 'authenticated')::text, true); perform set_config('request.jwt.claim.sub', uA::text, true);
  select count(*) into n from chat_faelle(null) where automatisch;
  r := r || 'R7 Admin sieht automatische Faelle=' || n || '; ';
  j := schutz_statistik(7);
  r := r || 'R8 Statistik blockiert=' || (j->>'blockiert') || ' nicht_geprueft=' || (j->>'nicht_geprueft') || '; ';
  select count(*) into n from chat_sperren_liste();
  r := r || 'R9 aktive Sperren=' || n || '; ';
  perform chat_sperre_aufheben((select s.id from chat_sperren_liste() s where s.user_id = uF limit 1));
  perform set_config('request.jwt.claims', json_build_object('sub', uF, 'role', 'authenticated')::text, true); perform set_config('request.jwt.claim.sub', uF::text, true);
  r := r || 'R10 nach Aufheben darf schreiben=' || darf_im_gespraech_schreiben(tz) || '; ';
  perform set_config('request.jwt.claims', json_build_object('sub', uA, 'role', 'authenticated')::text, true); perform set_config('request.jwt.claim.sub', uA::text, true);
  perform admin_chat_einstellungen_setzen('{"sperre_ab": 4, "oeffentlich_ab_16": 0}');
  perform set_config('request.jwt.claims', json_build_object('sub', uK, 'role', 'authenticated')::text, true); perform set_config('request.jwt.claim.sub', uK::text, true);
  r := r || 'R11 Einstellung: Kind darf oeffentlich schreiben=' || darf_im_gespraech_schreiben(tz) || '; ';
  perform set_config('request.jwt.claims', json_build_object('sub', uB, 'role', 'authenticated')::text, true); perform set_config('request.jwt.claim.sub', uB::text, true);
  begin perform admin_chat_einstellungen_setzen('{"sperre_ab": 1}'); r := r || 'R12 FEHLER Nutzer aendert Einstellungen; ';
  exception when others then r := r || 'R12 Einstellungen nur Admin; '; end;

  -- ===================== Bearbeiten / Weiterleiten =====================
  reset role;
  m := schutz_veroeffentlichen(uB2, tz, 'neu', null, '{"inhalt":"Bis gleich"}');
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', uB2, 'role', 'authenticated')::text, true); perform set_config('request.jwt.claim.sub', uB2::text, true);
  begin perform nachricht_bearbeiten(m, 'geaendert'); r := r || 'E1 FEHLER direkt bearbeitet; ';
  exception when others then r := r || 'E1 Bearbeiten nur ueber Pruefung; '; end;
  reset role;
  perform schutz_veroeffentlichen(uB2, tz, 'bearbeiten', m, '{"inhalt":"Bis später"}');
  r := r || 'E2 geprueft bearbeitet=' || (select inhalt from nachrichten where id = m) || '; ';
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', uB2, 'role', 'authenticated')::text, true); perform set_config('request.jwt.claim.sub', uB2::text, true);
  g := chat_dm_starten(uB);
  insert into nachrichten (gespraech_id, sender_id, inhalt) values (g, uB2, 'privat');
  r := r || 'E3 Privatchat direkt weiter möglich; ';
  begin perform nachricht_weiterleiten((select id from nachrichten where gespraech_id = g limit 1), tz); r := r || 'E4 FEHLER in oeffentlichen Chat weitergeleitet; ';
  exception when others then r := r || 'E4 Weiterleiten in oeffentlichen Chat gesperrt; '; end;

  raise exception 'ERGEBNIS:%', r;
end $$;
