-- Mitgliederimport + persoenliche Einladungen (Rollback-Test).
-- Eine Transaktion, endet mit raise exception 'ERGEBNIS:...' -> alles wird zurueckgerollt (inkl. der fuer
-- erfundene Testpersonen ausgesetzten Fremdschluessel). auth.users bleibt unberuehrt.
do $$
declare
  uV uuid := gen_random_uuid(); uB uuid := gen_random_uuid(); uK uuid := gen_random_uuid(); uN uuid := gen_random_uuid();
  uM uuid := gen_random_uuid(); uX uuid := gen_random_uuid(); uF uuid := gen_random_uuid();
  v uuid := gen_random_uuid(); vb uuid := gen_random_uuid();
  vmK uuid := gen_random_uuid(); vmX uuid := gen_random_uuid();
  admin_r uuid := 'd8b4d77d-b91a-4b3d-9260-2c29ee7c09f9'; taenzerin uuid := '89c3ab8a-824e-4ee1-84da-d68344a45335';
  r text := ''; n int; t text; j jsonb; zeilen jsonb;
  mAnna uuid; mLisa uuid; mMax uuid; tokAnna uuid; tokLisa uuid; tokMax uuid; eAnna uuid; tok2 uuid;
begin
  alter table vereins_mitglieder drop constraint vereins_mitglieder_user_id_fkey, drop constraint vereins_mitglieder_hinzugefuegt_von_fkey;
  alter table einladungen drop constraint einladungen_created_by_fkey;
  alter table benachrichtigungen drop constraint benachrichtigungen_user_id_fkey;
  alter table gespraech_teilnehmer drop constraint gespraech_teilnehmer_user_id_fkey;
  alter table mitglieder drop constraint mitglieder_user_id_fkey;
  alter table vereinswechsel_anfragen drop constraint vereinswechsel_anfragen_mitglied_user_id_fkey, drop constraint vereinswechsel_anfragen_angefragt_von_fkey;
  alter table profiles drop constraint profiles_id_fkey;
  insert into profiles (id, vorname, nachname, geschlecht) values
    (uV,'Vera','Vorstand','w'),(uB,'Bernd','Fremdadmin','m'),(uK,'Kim','Konto','w'),(uN,'Anna','Müller','w'),
    (uM,'Mallory','Fremd','w'),(uX,'Max','Weber','m'),(uF,'Frieda','Frei','w');
  insert into vereine (id, name, tarif, tarif_aktiv_bis) values
    (v, 'Importverein Test', 'verein', now() + interval '1 year'), (vb, 'Anderer Verein Test', 'verein', now() + interval '1 year');
  insert into vereins_mitglieder (user_id, verein_id, rolle_id) values (uV, v, admin_r), (uB, vb, admin_r);
  insert into vereins_mitglieder (id, user_id, verein_id, rolle_id) values (vmK, uK, v, taenzerin), (vmX, uX, vb, taenzerin);

  zeilen := '[
    {"vorname":"Anna","nachname":"Müller","email":"Anna@Example.de","mitgliedsnummer":"1","gruppe":"Jugendgarde","sepa_iban":"DE00123"},
    {"vorname":"Lisa","nachname":"Schmidt","mitgliedsnummer":"2","gruppe":"Jugendgarde"},
    {"vorname":"Max","nachname":"Weber","email":"max@example.de","mitgliedsnummer":"3","gruppe":"Schautanz"},
    {"vorname":"Kim","nachname":"Konto","mitgliedsnummer":"4","gruppe":"Jugendgarde"}]';

  -- Vereinsadmin: Pruefen (speichert nichts), Import
  perform set_config('request.jwt.claims', json_build_object('sub', uV, 'role','authenticated')::text, true);
  set local role authenticated;
  select string_agg(x.idx||':'||x.treffer||'/'||x.ziel_art, ',') into t from mitglieder_import_pruefen(v, zeilen) x;
  r := r||'1 Pruefen Treffer='||coalesce(t,'-')||'; ';
  select count(*) into n from mitglieder where verein_id = v; r := r||'2 nach Pruefen gespeichert='||n||'; ';
  zeilen := jsonb_set(zeilen, '{3}', (zeilen->3) || jsonb_build_object('aktion','vorhanden','ziel_art','konto','ziel_id',vmK));
  j := mitglieder_importieren(v, zeilen, '{"Jugendgarde":{"aktion":"neu"},"Schautanz":{"aktion":"keine"}}'::jsonb);
  r := r||'3 Import='||j::text||'; ';
  select id into mAnna from mitglieder where verein_id = v and vorname = 'Anna';
  select id into mLisa from mitglieder where verein_id = v and vorname = 'Lisa';
  select id into mMax from mitglieder where verein_id = v and vorname = 'Max';
  select coalesce(sepa_iban,'leer')||'/'||coalesce(telefon,'leer')||'/'||email into t from mitglieder where id = mAnna;
  r := r||'4 nicht gewaehlte Felder (iban/telefon)='||t||'; ';
  select string_agg(x.vorname||'='||x.status||'/'||coalesce(x.gruppe_name,'-'), ',' order by x.vorname) into t from mitglieder_register(v) x;
  r := r||'5 Status='||t||'; ';
  select count(*) into n from gruppen_mitglieder gm join gruppen g on g.id = gm.gruppe_id where g.verein_id = v and gm.vereins_mitglied_id = vmK;
  r := r||'6 Kim (Konto) in Gruppe='||n||'; ';

  -- Erneuter Import: Anna (E-Mail-Treffer, neue Telefonnummer), Lisa (Nummer), neue Nina
  zeilen := '[{"vorname":"Anna","nachname":"Müller","email":"anna@example.de","telefon":"0711 123"},
              {"vorname":"Lisa","nachname":"Schmidt","mitgliedsnummer":"2"},
              {"vorname":"Nina","nachname":"Neu","email":"nina@example.de"}]';
  select string_agg(x.idx||':'||x.treffer||':'||x.aenderungen::text, ' | ') into t from mitglieder_import_pruefen(v, zeilen) x;
  r := r||'7 Re-Import Pruefen='||t||'; ';
  zeilen := jsonb_set(zeilen, '{0}', (zeilen->0) || jsonb_build_object('aktion','vorhanden','ziel_art','register','ziel_id',mAnna,'uebernehmen',false));
  zeilen := jsonb_set(zeilen, '{1}', (zeilen->1) || jsonb_build_object('aktion','vorhanden','ziel_art','register','ziel_id',mLisa));
  j := mitglieder_importieren(v, zeilen, null);
  select coalesce(telefon,'leer') into t from mitglieder where id = mAnna;
  r := r||'8 Re-Import='||j::text||', Anna Telefon ohne Zustimmung='||t||'; ';
  select count(*) into n from mitglieder where verein_id = v; r := r||'8b Stammdaten gesamt='||n||'; ';

  -- Einladungen
  select x.token, x.einladung_id into tokAnna, eAnna from mitglied_einladungen_erstellen(v, array[mAnna]) x;
  select x.token into tokLisa from mitglied_einladungen_erstellen(v, array[mLisa]) x;
  select x.token into tokMax from mitglied_einladungen_erstellen(v, array[mMax]) x;
  select x.token into tok2 from mitglied_einladungen_erstellen(v, array[mAnna]) x;
  r := r||'9 Link wiederverwendet='||(tok2 = tokAnna)::text||'; ';
  begin perform mitglied_einladung_versand((select einladung_id from mitglied_einladungen_erstellen(v, array[mLisa])));
    r := r||'10 FEHLER Lisa ohne E-Mail versendet; ';
  exception when others then r := r||'10 Lisa ohne E-Mail: '||sqlerrm||'; '; end;
  r := r||'11 Versand an='||mitglied_einladung_versand(eAnna)||'; ';
  perform mitglied_einladung_gesendet(eAnna);
  begin perform mitglied_einladung_versand(eAnna); r := r||'12 FEHLER doppelt; ';
  exception when others then r := r||'12 Doppelversand gesperrt; '; end;
  select string_agg(x.vorname||'='||x.status, ',' order by x.vorname) into t from mitglieder_register(v) x where x.vereins_mitglied_id is null;
  r := r||'13 Status='||t||'; ';
  perform mitglied_einladung_widerrufen(mLisa);
  reset role;

  -- Rechte: fremder Vereinsadmin, Mitglied, Free-Nutzer
  perform set_config('request.jwt.claims', json_build_object('sub', uB, 'role','authenticated')::text, true);
  set local role authenticated;
  begin perform * from mitglieder_register(v); r := r||'14 FEHLER fremder Admin sieht Liste; ';
  exception when others then r := r||'14 fremder Admin Liste gesperrt; '; end;
  begin perform * from mitglied_einladungen_erstellen(v, array[mMax]); r := r||'14b FEHLER fremder Admin laedt ein; ';
  exception when others then r := r||'14b fremder Admin Einladen gesperrt; '; end;
  begin perform mitglieder_importieren(v, '[{"vorname":"A","nachname":"B"}]'); r := r||'14c FEHLER fremder Import; ';
  exception when others then r := r||'14c fremder Import gesperrt; '; end;
  select count(*) into n from mitglieder where verein_id = v; r := r||'14d fremder Admin direkt sichtbar='||n||'; ';
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', uK, 'role','authenticated')::text, true);
  set local role authenticated;
  begin perform * from mitglieder_register(v); r := r||'15 FEHLER Mitglied sieht Liste; ';
  exception when others then r := r||'15 Mitglied Liste gesperrt; '; end;
  begin perform mitglied_stammdaten_aendern(mAnna, '{"email":"x@y.de"}'); r := r||'15b FEHLER Mitglied aendert; ';
  exception when others then r := r||'15b Mitglied Aendern gesperrt; '; end;
  select count(*) into n from mitglieder where verein_id = v; r := r||'15c Mitglied direkt sichtbar='||n||'; ';
  reset role;

  -- Anonyme Vorschau des persoenlichen Links
  perform set_config('request.jwt.claims', '{}', true);
  set local role anon;
  select x.verein_name||'/'||x.persoenlich::text||'/'||coalesce(x.gruppe_name,'-')||'/'||x.gueltig::text into t from einladung_vorschau(tokAnna) x;
  r := r||'16 anon Vorschau='||t||'; ';
  begin select count(*) into n from mitglieder; r := r||'16b anon sieht Stammdaten='||n||'; ';
  exception when others then r := r||'16b anon gesperrt; '; end;
  reset role;

  -- Registrierte Person loest Annas Link ein
  perform set_config('request.jwt.claims', json_build_object('sub', uN, 'role','authenticated')::text, true);
  set local role authenticated;
  j := invite_einloesen(tokAnna); r := r||'17 Einloesen='||(j->>'success')||coalesce(' '||(j->>'error'),'')||'; ';
  reset role;
  select vm.aufnahme_status||'/'||coalesce(vm.aktiv,true)::text||'/'||r2.name into t from vereins_mitglieder vm join rollen r2 on r2.id = vm.rolle_id where vm.user_id = uN;
  r := r||'18 neue Mitgliedschaft='||t||'; ';
  select (m.vereins_mitglied_id is not null)::text||'/'||(m.user_id = uN)::text into t from mitglieder m where m.id = mAnna;
  r := r||'19 verbunden='||t||'; ';
  select count(*) into n from gruppen_mitglieder gm join vereins_mitglieder vm on vm.id = gm.vereins_mitglied_id where vm.user_id = uN;
  r := r||'20 Anna in Gruppe='||n||'; ';
  perform set_config('request.jwt.claims', json_build_object('sub', uV, 'role','authenticated')::text, true);
  set local role authenticated;
  select x.status into t from mitglieder_register(v) x where x.id = mAnna; r := r||'21 Status Anna='||t||'; ';
  reset role;

  -- Zweite Person mit demselben Link, widerrufener Link
  perform set_config('request.jwt.claims', json_build_object('sub', uM, 'role','authenticated')::text, true);
  set local role authenticated;
  j := invite_einloesen(tokAnna); r := r||'22 zweites Einloesen='||(j->>'success')||' '||(j->>'error')||'; ';
  j := invite_einloesen(tokLisa); r := r||'23 widerrufen='||(j->>'success')||' '||(j->>'error')||'; ';
  reset role;

  -- Max hat schon ein Konto in einem anderen Verein: Freigabe, danach automatische Verbindung
  perform set_config('request.jwt.claims', json_build_object('sub', uX, 'role','authenticated')::text, true);
  set local role authenticated;
  j := invite_einloesen(tokMax); r := r||'24 Max anderer Verein='||(j->>'success')||'; ';
  reset role;
  delete from vereins_mitglieder where id = vmX;
  insert into vereins_mitglieder (user_id, verein_id, rolle_id) values (uX, v, taenzerin);
  select (m.vereins_mitglied_id is not null)::text into t from mitglieder m where m.id = mMax;
  r := r||'25 Max nach Wechsel verbunden='||t||'; ';

  -- Free-Nutzer ohne Verein sieht nichts
  perform set_config('request.jwt.claims', json_build_object('sub', uF, 'role','authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from mitglieder; r := r||'26 Free sieht Stammdaten='||n||'; ';
  begin perform * from mitglieder_import_pruefen(v, '[]'); r := r||'26b FEHLER Free prueft; ';
  exception when others then r := r||'26b Free Pruefen gesperrt; '; end;
  reset role;

  raise exception 'ERGEBNIS:%', r;
end;
$$;
