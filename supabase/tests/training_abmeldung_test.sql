-- Rechte-Test Training & Abmeldung (20260930230804_training_abmeldung.sql).
-- Laeuft komplett in EINER Transaktion und endet immer mit raise exception 'ERGEBNIS:...' -> alles wird zurueckgerollt.
-- Testpersonen sind erfundene UUIDs (auth.users bleibt unberuehrt); dafuer werden Fremdschluessel nur innerhalb
-- dieser zurueckgerollten Transaktion ausgesetzt (session_replication_role = replica bzw. drop constraint).
-- Ausfuehren z. B. im SQL-Editor; Ergebnis steht in der Fehlermeldung.
do $$
declare
  v1 uuid := gen_random_uuid(); v2 uuid := gen_random_uuid(); v3 uuid := gen_random_uuid();
  uT uuid := gen_random_uuid(); uM uuid := gen_random_uuid(); uP uuid := gen_random_uuid(); uK uuid := gen_random_uuid();
  uF uuid := gen_random_uuid(); uT3 uuid := gen_random_uuid(); uA uuid := gen_random_uuid(); uB uuid := gen_random_uuid(); uX uuid := gen_random_uuid();
  vmT uuid := gen_random_uuid(); vmM uuid := gen_random_uuid(); vmP uuid := gen_random_uuid(); vmK uuid := gen_random_uuid();
  vmF uuid := gen_random_uuid(); vmT3 uuid := gen_random_uuid(); vmA uuid := gen_random_uuid(); vmB uuid := gen_random_uuid(); vmX uuid := gen_random_uuid();
  g1 uuid := gen_random_uuid(); g2 uuid := gen_random_uuid(); g3 uuid := gen_random_uuid(); gf uuid := gen_random_uuid(); gx uuid := gen_random_uuid();
  heute date := (now() at time zone 'Europe/Berlin')::date;
  r text := '';
  n int; t text; j jsonb; ts1 timestamptz; ts2 timestamptz;
begin
  set local session_replication_role = replica;
  insert into vereine (id, name, tarif) values (v1, 'TSC Test', 'verein'), (v2, 'Fremdverein', 'verein'), (v3, 'Ohne Lizenz', 'basic');
  insert into profiles (id, vorname, nachname) values
    (uT,'Tina','Trainer'),(uM,'Maximilian Alexander','Mustermann'),(uP,'Paula','Mueller'),(uK,'Emma','Mueller'),
    (uF,'Fritz','Fremd'),(uT3,'Tom','Dritter'),(uA,'Anna','Admin'),(uB,'Bert','Betreuer'),(uX,'Xaver','Ohne');
  insert into vereins_mitglieder (id, user_id, verein_id, rolle_id) values
    (vmT,uT,v1,'3a67e130-010d-4660-9b99-0b2615936fa9'),(vmM,uM,v1,'f4be9b33-ff8d-418c-a0af-dc2a3056ae9a'),
    (vmP,uP,v1,'f9baeba7-e589-49b2-b3ae-f2f330ee000f'),(vmK,uK,v1,'89c3ab8a-824e-4ee1-84da-d68344a45335'),
    (vmF,uF,v2,'f4be9b33-ff8d-418c-a0af-dc2a3056ae9a'),(vmT3,uT3,v1,'3a67e130-010d-4660-9b99-0b2615936fa9'),
    (vmA,uA,v1,'d8b4d77d-b91a-4b3d-9260-2c29ee7c09f9'),(vmB,uB,v1,'fff0ae45-0833-4af3-a08c-db2d750d0b78'),
    (vmX,uX,v3,'f4be9b33-ff8d-418c-a0af-dc2a3056ae9a');
  insert into gruppen (id, verein_id, name) values (g1,v1,'Karnevalistischer Showtanz Nachwuchsgruppe'),(g2,v1,'Minis'),(g3,v1,'Garde'),(gf,v2,'Fremdgruppe'),(gx,v3,'Basicgruppe');
  insert into gruppen_mitglieder (gruppe_id, vereins_mitglied_id, funktion) values
    (g1,vmT,'trainer'),(g1,vmB,'betreuer'),(g1,vmM,'mitglied'),(g1,vmK,'mitglied'),
    (g2,vmT,'trainer'),(g2,vmK,'mitglied'),
    (g3,vmT3,'trainer'),(g3,vmM,'mitglied'),
    (gf,vmF,'mitglied'),(gx,vmX,'mitglied');
  insert into eltern_kind_zuordnung (verein_id, eltern_vm_id, kind_vm_id) values (v1, vmP, vmK);
  insert into trainingstermine (verein_id, gruppe_id, ist_wiederholend, wochentag, datum, von, bis) values
    (v1,g1,true,extract(isodow from heute)::int,null,'17:00','18:30'),
    (v1,g2,false,null,heute,'16:00','17:00'),
    (v1,g3,true,extract(isodow from heute)::int,null,'19:00','20:30'),
    (v2,gf,false,null,heute,'18:00','19:00'),
    (v3,gx,false,null,heute,'18:00','19:00');
  set local session_replication_role = origin;
  alter table benachrichtigungen drop constraint benachrichtigungen_user_id_fkey;

  perform set_config('request.jwt.claims', json_build_object('sub', uM, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    insert into trainings_abmeldungen (verein_id, gruppe_id, datum, vereins_mitglied_id, grund_kategorie) values (v1,g1,heute,vmM,'krankheit');
    r := r || '1 selbst ok; ';
  exception when others then r := r || '1 FEHLER ' || coalesce(sqlerrm,'') || '; '; end;
  reset role;
  select grund, quelle, erstellt_am into t, j, ts1 from (select grund, to_jsonb(quelle) quelle, erstellt_am from trainings_abmeldungen where vereins_mitglied_id=vmM and gruppe_id=g1) x;
  r := r || '1 grund=' || coalesce(t,'NULL') || ' quelle=' || coalesce(j::text,'NULL') || '; ';
  select count(*) into n from benachrichtigungen where typ='training_abmeldung' and user_id=uT; r := r || '1 notif T=' || n || '; ';
  select count(*) into n from benachrichtigungen where typ='training_abmeldung' and user_id in (uB,uM,uT3,uA); r := r || '1 notif andere=' || n || '; ';
  select text into t from benachrichtigungen where typ='training_abmeldung' and user_id=uT limit 1; r := r || '1 text=' || coalesce(t,'NULL') || '; ';

  perform set_config('request.jwt.claims', json_build_object('sub', uM, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    insert into trainings_abmeldungen (verein_id, gruppe_id, datum, vereins_mitglied_id, grund_kategorie, hinweis) values (v1,g1,heute,vmM,'schule','Klausur')
    on conflict (gruppe_id, datum, vereins_mitglied_id) do update set grund_kategorie = excluded.grund_kategorie, hinweis = excluded.hinweis;
    r := r || '2 upsert ok; ';
  exception when others then r := r || '2 FEHLER ' || coalesce(sqlerrm,'') || '; '; end;
  reset role;
  select count(*), max(grund), max(erstellt_am) into n, t, ts2 from trainings_abmeldungen where vereins_mitglied_id=vmM and gruppe_id=g1;
  r := r || '2 zeilen=' || n || ' grund=' || coalesce(t,'NULL') || ' zeit gleich=' || coalesce((ts1 = ts2)::text,'NULL') || '; ';

  perform set_config('request.jwt.claims', json_build_object('sub', uP, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    insert into trainings_abmeldungen (verein_id, gruppe_id, datum, vereins_mitglied_id, grund_kategorie) values (v1,g1,heute,vmK,'arzttermin');
    insert into trainings_abmeldungen (verein_id, gruppe_id, datum, vereins_mitglied_id, grund_kategorie) values (v1,g2,heute,vmK,'familie');
    r := r || '3 eltern ok; ';
  exception when others then r := r || '3 FEHLER ' || coalesce(sqlerrm,'') || '; '; end;
  begin
    insert into trainings_abmeldungen (verein_id, gruppe_id, datum, vereins_mitglied_id, grund_kategorie) values (v2,gf,heute,vmF,'krankheit');
    r := r || '5 FEHLER fremdes Kind erlaubt; ';
  exception when others then r := r || '5 fremdes Kind abgelehnt (' || sqlstate || '); '; end;
  begin
    delete from trainings_abmeldungen where vereins_mitglied_id = vmM;
    get diagnostics n = row_count;
    r := r || '6 fremde Abmeldung loeschen: ' || n || ' Zeilen; ';
  exception when others then r := r || '6 abgelehnt; '; end;
  begin
    update trainings_abmeldungen set grund_kategorie='urlaub' where vereins_mitglied_id = vmM;
    get diagnostics n = row_count;
    r := r || '6b fremde Abmeldung aendern: ' || n || ' Zeilen; ';
  exception when others then r := r || '6b abgelehnt; '; end;
  reset role;
  select string_agg(grund, ' | ' order by grund) into t from trainings_abmeldungen where vereins_mitglied_id=vmK;
  r := r || '3 gruende Kind=' || coalesce(t,'NULL') || '; ';
  select count(*) into n from benachrichtigungen where typ='training_abmeldung' and user_id=uT; r := r || '3 notif T gesamt=' || n || '; ';

  perform set_config('request.jwt.claims', json_build_object('sub', uT, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    insert into trainings_abmeldungen (verein_id, gruppe_id, datum, vereins_mitglied_id, grund_kategorie) values (v1,g1,heute,vmM,'urlaub')
    on conflict (gruppe_id, datum, vereins_mitglied_id) do update set grund_kategorie = excluded.grund_kategorie, hinweis = excluded.hinweis;
    r := r || '7 trainer korrigiert; ';
  exception when others then r := r || '7 FEHLER ' || coalesce(sqlerrm,'') || '; '; end;
  select count(*) into n from training_teilnehmer(g1, heute); r := r || '16 teilnehmer G1=' || n || '; ';
  begin perform * from training_teilnehmer(g3, heute); r := r || '16 FEHLER T sieht G3; ';
  exception when others then r := r || '16 T fuer G3 abgelehnt; '; end;
  select string_agg(x.gruppe_name || ':' || coalesce(jsonb_array_length(x.abmeldungen)::text, 'null') || ':' || jsonb_array_length(x.personen), ', ' order by x.gruppe_name) into t
    from training_kalender(heute, heute) x;
  r := r || '12 kalender T=' || coalesce(t,'NULL') || '; ';
  reset role;
  select grund into t from trainings_abmeldungen where vereins_mitglied_id=vmM and gruppe_id=g1; r := r || '7 grund=' || coalesce(t,'NULL') || '; ';

  perform set_config('request.jwt.claims', json_build_object('sub', uT3, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    insert into trainings_abmeldungen (verein_id, gruppe_id, datum, vereins_mitglied_id, grund_kategorie) values (v1,g1,heute,vmK,'krankheit')
    on conflict (gruppe_id, datum, vereins_mitglied_id) do update set grund_kategorie = excluded.grund_kategorie;
    r := r || '8 FEHLER T3 durfte; ';
  exception when others then r := r || '8 T3 abgelehnt (' || sqlstate || '); '; end;
  update trainings_abmeldungen set grund_kategorie='urlaub' where gruppe_id = g1; get diagnostics n = row_count; r := r || '8 T3 update G1=' || n || '; ';
  select string_agg(x.gruppe_name || ':' || coalesce(jsonb_array_length(x.abmeldungen)::text, 'null'), ', ' order by x.gruppe_name) into t from training_kalender(heute, heute) x;
  r := r || '8 kalender T3=' || coalesce(t,'NULL') || '; ';
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', uB, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    insert into trainings_abmeldungen (verein_id, gruppe_id, datum, vereins_mitglied_id, grund_kategorie) values (v1,g1,heute,vmT,'krankheit');
    r := r || '9 FEHLER Betreuer durfte; ';
  exception when others then r := r || '9 Betreuer eintragen abgelehnt; '; end;
  select string_agg(x.gruppe_name || ':' || coalesce(jsonb_array_length(x.abmeldungen)::text, 'null'), ', ' order by x.gruppe_name) into t from training_kalender(heute, heute) x;
  r := r || '9 kalender B=' || coalesce(t,'-') || '; ';
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', uX, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    insert into trainings_abmeldungen (verein_id, gruppe_id, datum, vereins_mitglied_id, grund_kategorie) values (v3,gx,heute,vmX,'krankheit');
    r := r || '10 FEHLER ohne Lizenz erlaubt; ';
  exception when others then r := r || '10 ohne Lizenz abgelehnt: ' || coalesce(sqlerrm,'') || '; '; end;
  select count(*) into n from training_kalender(heute, heute); r := r || '10 kalender X=' || n || '; ';
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', uM, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    insert into trainings_abmeldungen (verein_id, gruppe_id, datum, vereins_mitglied_id, grund_kategorie) values (v1,g1,heute+1,vmM,'krankheit');
    r := r || '11 FEHLER ohne Termin erlaubt; ';
  exception when others then r := r || '11 ohne Termin abgelehnt: ' || coalesce(sqlerrm,'') || '; '; end;
  select string_agg(x.gruppe_name || ':' || coalesce(jsonb_array_length(x.abmeldungen)::text, 'null') || ':' || (x.personen->0->>'abgemeldet') || ':' || coalesce(x.personen->0->>'kategorie','-'), ', ' order by x.gruppe_name) into t from training_kalender(heute, heute + 7) x where x.datum = heute;
  r := r || '13 kalender M=' || coalesce(t,'NULL') || '; ';
  select count(*) into n from training_kalender(heute, heute + 7) x where x.gruppe_id = g1; r := r || '13 G1-Termine in 8 Tagen=' || n || '; ';
  select count(*) into n from training_kalender(heute, heute + 7) x where x.gruppe_id = g1 and (x.personen->0->>'abgemeldet')::boolean; r := r || '13 davon abgemeldet=' || n || '; ';
  begin perform * from training_teilnehmer(g1, heute); r := r || '16 FEHLER M sieht Teilnehmer; ';
  exception when others then r := r || '16 M Teilnehmer abgelehnt; '; end;
  select count(*) into n from trainings_abmeldungen; r := r || '17 M sieht Abmeldungen (RLS)=' || n || '; ';
  delete from trainings_abmeldungen where vereins_mitglied_id = vmM and gruppe_id = g1 and datum = heute; get diagnostics n = row_count;
  r := r || '18 wieder angemeldet=' || n || '; ';
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', uP, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select string_agg(x.gruppe_name || ':' || coalesce(jsonb_array_length(x.abmeldungen)::text, 'null') || ':' || coalesce(x.personen->0->>'name','-') || ':' || coalesce(x.personen->0->>'kategorie','-') || ':' || jsonb_array_length(x.personen), ', ' order by x.gruppe_name) into t from training_kalender(heute, heute) x;
  r := r || '14 kalender P=' || coalesce(t,'NULL') || '; ';
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', uF, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select string_agg(x.gruppe_name, ', ') into t from training_kalender(heute, heute) x; r := r || '15 kalender F=' || coalesce(t,'NULL') || '; ';
  select count(*) into n from trainings_abmeldungen; r := r || '15 F sieht Abmeldungen V1=' || n || '; ';
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', uA, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select string_agg(x.gruppe_name || ':' || coalesce(jsonb_array_length(x.abmeldungen)::text, 'null'), ', ' order by x.gruppe_name) into t from training_kalender(heute, heute) x;
  r := r || '17 kalender Admin=' || coalesce(t,'NULL') || '; ';
  reset role;

  raise exception 'ERGEBNIS:%', r;
end $$;
