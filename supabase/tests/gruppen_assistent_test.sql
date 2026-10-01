-- Rechte-/Logik-Test Gruppen-Assistent (20261001001959_gruppen_assistent.sql).
-- Laeuft in EINER Transaktion und endet mit raise exception 'ERGEBNIS:...' -> alles wird zurueckgerollt.
-- Testpersonen sind erfundene UUIDs (auth.users bleibt unberuehrt; Fremdschluessel nur waehrend des Anlegens ausgesetzt).
do $$
declare
  v1 uuid := gen_random_uuid(); v2 uuid := gen_random_uuid(); v3 uuid := gen_random_uuid();
  uA uuid := gen_random_uuid(); uT uuid := gen_random_uuid(); uB uuid := gen_random_uuid(); uW1 uuid := gen_random_uuid(); uW2 uuid := gen_random_uuid();
  uM1 uuid := gen_random_uuid(); uM uuid := gen_random_uuid(); uX uuid := gen_random_uuid(); uA3 uuid := gen_random_uuid();
  vA uuid := gen_random_uuid(); vT uuid := gen_random_uuid(); vB uuid := gen_random_uuid(); vW1 uuid := gen_random_uuid(); vW2 uuid := gen_random_uuid();
  vM1 uuid := gen_random_uuid(); vM uuid := gen_random_uuid(); vX uuid := gen_random_uuid(); vA3 uuid := gen_random_uuid();
  akJ uuid; akU uuid; dGarde uuid; dGem uuid; dPaar uuid; dSW uuid; dSM uuid;
  g uuid; r text := ''; n int; t text;
begin
  select id into akJ from altersklassen where name='Jugend'; select id into akU from altersklassen where name='Ü15';
  select id into dGarde from disziplinen where name='Tanzgarden'; select id into dGem from disziplinen where name ilike 'Gemischte Garde%';
  select id into dPaar from disziplinen where name='Tanzpaare'; select id into dSW from disziplinen where name='Solist weiblich'; select id into dSM from disziplinen where name='Solist männlich';
  set local session_replication_role = replica;
  insert into vereine (id, name, tarif) values (v1,'TSC Test','verein'),(v2,'Fremd','verein'),(v3,'Ohne Lizenz','basic');
  insert into profiles (id, vorname, nachname, geschlecht) values (uA,'Anna','Admin','w'),(uT,'Tom','Trainer','m'),(uB,'Bea','Betreuer','w'),
    (uW1,'Wanda','Eins','w'),(uW2,'Wilma','Zwei','w'),(uM1,'Max','Eins','m'),(uM,'Mia','Mitglied','w'),(uX,'Xaver','Fremd','m'),(uA3,'Otto','Ohne','m');
  insert into vereins_mitglieder (id,user_id,verein_id,rolle_id) values
    (vA,uA,v1,'d8b4d77d-b91a-4b3d-9260-2c29ee7c09f9'),(vT,uT,v1,'3a67e130-010d-4660-9b99-0b2615936fa9'),(vB,uB,v1,'fff0ae45-0833-4af3-a08c-db2d750d0b78'),
    (vW1,uW1,v1,'89c3ab8a-824e-4ee1-84da-d68344a45335'),(vW2,uW2,v1,'89c3ab8a-824e-4ee1-84da-d68344a45335'),(vM1,uM1,v1,'f4be9b33-ff8d-418c-a0af-dc2a3056ae9a'),
    (vM,uM,v1,'89c3ab8a-824e-4ee1-84da-d68344a45335'),(vX,uX,v2,'d8b4d77d-b91a-4b3d-9260-2c29ee7c09f9'),(vA3,uA3,v3,'d8b4d77d-b91a-4b3d-9260-2c29ee7c09f9');
  set local session_replication_role = origin;

  perform set_config('request.jwt.claims', json_build_object('sub', uA, 'role','authenticated')::text, true);
  set local role authenticated;
  begin g := gruppe_speichern(v1,null,'Bambini-Gruppe',null,'Bambinis',null,array[vW1,vM1],array[vT],array[vB]); r := r||'1 Bambinis ok; ';
  exception when others then r := r||'1 FEHLER '||sqlerrm||'; '; end;
  begin g := gruppe_speichern(v1,null,'Jugendgarde 1',akJ,null,dGarde,array[vW1,vW2,vM],array[vT],null); r := r||'2 Jugend+Tanzgarden ok; ';
  exception when others then r := r||'2 FEHLER '||sqlerrm||'; '; end;
  select (x->>'anzahl')||'/'||(x->>'trainer_anzahl')||'/'||coalesce(x->>'altersklasse','-')||'/'||coalesce(x->>'disziplin','-') into t from jsonb_array_elements(verein_uebersicht(v1)->'gruppen') x where x->>'id' = g::text;
  r := r||'2 staerke/trainer/ak/disz='||coalesce(t,'NULL')||'; ';
  begin perform gruppe_speichern(v1,null,'Jugend Gemischt',akJ,null,dGem,null,null,null); r := r||'3 FEHLER Gemischt in Jugend erlaubt; ';
  exception when others then r := r||'3 Jugend+Gemischt abgelehnt; '; end;
  begin perform gruppe_speichern(v1,null,'Gemischte Garde Ü',akU,null,dGem,array[vW1,vM1],array[vT],null); r := r||'4 Ü15+Gemischt w+m ok; ';
  exception when others then r := r||'4 FEHLER '||sqlerrm||'; '; end;
  begin perform gruppe_speichern(v1,null,'Tanzpaar Eins',akU,null,dPaar,array[vW1,vM1],null,null); r := r||'5 Tanzpaar w+m ok; ';
  exception when others then r := r||'5 FEHLER '||sqlerrm||'; '; end;
  begin perform gruppe_speichern(v1,null,'Tanzpaar Falsch',akU,null,dPaar,array[vW1,vW2],null,null); r := r||'6 FEHLER w+w erlaubt; ';
  exception when others then r := r||'6 Tanzpaar w+w abgelehnt; '; end;
  begin perform gruppe_speichern(v1,null,'Solo W',akJ,null,dSW,array[vM1],null,null); r := r||'7 FEHLER Solist weiblich mit m; ';
  exception when others then r := r||'7 Solist weiblich+m abgelehnt; '; end;
  begin perform gruppe_speichern(v1,null,'Solo W2',akJ,null,dSW,array[vW2],null,null); r := r||'8 Solist weiblich ok; ';
  exception when others then r := r||'8 FEHLER '||sqlerrm||'; '; end;
  begin perform gruppe_speichern(v1,null,'Solo M zwei',akJ,null,dSM,array[vM1,vT],null,null); r := r||'9 FEHLER 2 Solisten; ';
  exception when others then r := r||'9 Solist 2 Personen abgelehnt; '; end;
  begin perform gruppe_speichern(v1,null,'Ü15',null,null,null,null,null,null); r := r||'10 FEHLER Ü15 als Gruppenname; ';
  exception when others then r := r||'10 Name=Altersklasse abgelehnt; '; end;
  begin perform gruppe_speichern(v1,null,'Trainerfehler',null,null,null,null,array[vW1],null); r := r||'11 FEHLER Tänzerin als Trainer; ';
  exception when others then r := r||'11 Trainer ohne Rolle abgelehnt; '; end;
  begin perform gruppe_speichern(v1,null,'Doppelt',null,null,null,array[vT],array[vT],null); r := r||'12 FEHLER doppelte Aufgabe; ';
  exception when others then r := r||'12 doppelte Aufgabe abgelehnt; '; end;
  begin perform gruppe_speichern(v1,null,'Fremd drin',null,null,null,array[vX],null,null); r := r||'13 FEHLER fremdes Mitglied; ';
  exception when others then r := r||'13 fremdes Mitglied abgelehnt; '; end;
  begin perform gruppe_speichern(v1,null,'Schnell',null,null,null,null,null,null,false); r := r||'14 Schnell anlegen ok; ';
  exception when others then r := r||'14 FEHLER '||sqlerrm||'; '; end;
  begin perform gruppe_speichern(v1,g,'Jugendgarde 1',akJ,null,dGarde,array[vW1],array[vT],array[vB]); r := r||'15 bearbeitet; ';
  exception when others then r := r||'15 FEHLER '||sqlerrm||'; '; end;
  select count(*) filter (where funktion='mitglied')||'/'||count(*) filter (where funktion='trainer')||'/'||count(*) filter (where funktion='betreuer') into t from gruppen_mitglieder where gruppe_id=g;
  r := r||'15 besetzung m/t/b='||t||'; ';
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', uT, 'role','authenticated')::text, true);
  set local role authenticated;
  r := r||'17 Trainer betreut Gruppe='||ist_gruppen_betreuung(g)::text||'; ';
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', uM, 'role','authenticated')::text, true);
  set local role authenticated;
  begin perform gruppe_speichern(v1,null,'Mitglied darf nicht',null,null,null,null,null,null); r := r||'18 FEHLER Mitglied durfte; ';
  exception when others then r := r||'18 Mitglied abgelehnt; '; end;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', uX, 'role','authenticated')::text, true);
  set local role authenticated;
  begin perform gruppe_speichern(v1,null,'Fremder Admin',null,null,null,null,null,null); r := r||'19 FEHLER fremder Admin; ';
  exception when others then r := r||'19 fremder Vereinsadmin abgelehnt; '; end;
  select count(*) into n from gruppen where verein_id=v1; r := r||'19b fremder sieht Gruppen V1='||n||'; ';
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', uA3, 'role','authenticated')::text, true);
  set local role authenticated;
  begin perform gruppe_speichern(v3,null,'Ohne Lizenz',null,null,null,null,null,null); r := r||'20 FEHLER ohne Lizenz; ';
  exception when others then r := r||'20 ohne Lizenz abgelehnt; '; end;
  reset role;
  raise exception 'ERGEBNIS:%', r;
end $$;
