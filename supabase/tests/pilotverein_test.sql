-- Pilotablauf-Test (Vereinsanlage, manuelle Lizenz, Vereinsadmin-Einladung, Beitrittsanfrage, Rechte).
-- Eine Transaktion, endet mit raise exception 'ERGEBNIS:...' -> alles wird zurueckgerollt (inkl. der fuer
-- erfundene Testpersonen ausgesetzten Fremdschluessel). auth.users bleibt unberuehrt.
do $$
declare
  uP uuid := gen_random_uuid(); uV uuid := gen_random_uuid(); uF uuid := gen_random_uuid(); uZ uuid := gen_random_uuid(); uX uuid := gen_random_uuid();
  v uuid; vb uuid; e_id uuid; tok uuid; r text := ''; n int; t text; j jsonb; anf uuid; vmX uuid := gen_random_uuid();
begin
  alter table vereins_mitglieder drop constraint vereins_mitglieder_user_id_fkey, drop constraint vereins_mitglieder_hinzugefuegt_von_fkey;
  alter table einladungen drop constraint einladungen_created_by_fkey;
  alter table benachrichtigungen drop constraint benachrichtigungen_user_id_fkey;
  alter table tarif_ereignisse drop constraint tarif_ereignisse_user_id_fkey;
  alter table abos drop constraint abos_user_id_fkey;
  alter table beitrittsantraege drop constraint beitrittsantraege_user_id_fkey, drop constraint beitrittsantraege_erstellt_von_fkey;
  alter table vereins_beitrittsanfragen drop constraint vereins_beitrittsanfragen_user_id_fkey;
  alter table gespraech_teilnehmer drop constraint gespraech_teilnehmer_user_id_fkey;
  alter table profiles drop constraint profiles_id_fkey;
  insert into profiles (id, vorname, nachname, geschlecht, ist_plattform_admin) values
    (uP,'Plattform','Admin','m',true),(uV,'Vera','Vorstand','w',false),(uF,'Frieda','Frei','w',false),(uZ,'Zweite','Person','m',false),(uX,'Xaver','Anderverein','m',false);
  insert into vereine (id, name, tarif) values (gen_random_uuid(), 'Anderer Verein Test', 'verein') returning id into vb;
  insert into vereins_mitglieder (id, user_id, verein_id, rolle_id) values (vmX, uX, vb, 'd8b4d77d-b91a-4b3d-9260-2c29ee7c09f9');

  perform set_config('request.jwt.claims', json_build_object('sub', uP, 'role','authenticated')::text, true);
  set local role authenticated;
  v := admin_verein_anlegen('Cannstatter Quellenclub (Test)', 'CQC', 'Teststr.', '1', '70372', 'Stuttgart', 'info@example.org');
  r := r||'2 Lizenz vorher='||verein_hat_lizenz(v)::text||'; ';
  j := admin_vereinslizenz_setzen(v, (now() at time zone 'Europe/Berlin')::date, 12, 0, 'active');
  r := r||'3 Lizenz='||j::text||'; ';
  select x.einladung_id, x.token into e_id, tok from admin_vereinsadmin_einladen(v, 'Admin@Verein.de') x;
  select count(*) into n from mail_einladung_daten(e_id); r := r||'5 Mail-Daten fuer Admin='||n||'; ';
  reset role;
  select count(*) into n from vereins_mitglieder where verein_id = v; r := r||'1 Verein angelegt, Mitglieder='||n||'; ';
  select ab.preis_cent||'/'||ab.anbieter||'/'||ab.status||'/'||ab.periode into t from abos ab where ab.verein_id = v and abo_gilt(ab); r := r||'3b abo='||t||'; ';

  perform set_config('request.jwt.claims', '{}', true);
  set local role anon;
  select x.verein_name||'/'||x.rolle||'/'||x.gueltig::text||'/'||x.admin_einladung::text into t from einladung_vorschau(tok) x; r := r||'7 anon Vorschau='||t||'; ';
  begin perform * from admin_vereinsadmin_einladungen(v); r := r||'7b FEHLER anon Admin-Liste; ';
  exception when others then r := r||'7b anon Admin-Liste gesperrt; '; end;
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', uV, 'role','authenticated')::text, true);
  set local role authenticated;
  j := invite_einloesen(tok); r := r||'9 Annahme='||(j->>'success')||'; ';
  r := r||'10 V ist Vereinsadmin='||is_verein_admin(v)::text||', Tarif='||mein_tarif()||'; ';
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', uZ, 'role','authenticated')::text, true);
  set local role authenticated;
  j := invite_einloesen(tok); r := r||'8b zweite Annahme='||(j->>'success')||'; ';
  r := r||'8c Z ohne Verein, Tarif='||mein_tarif()||'; ';
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', uP, 'role','authenticated')::text, true);
  set local role authenticated;
  select string_agg(x.status, ',') into t from admin_vereinsadmin_einladungen(v) x; r := r||'6 Status='||t||'; ';
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', uF, 'role','authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from vereine_suchen('Cannstatter'); r := r||'15 Suche='||n||'; ';
  anf := beitritt_anfragen(v, 'Ich tanze gern');
  begin perform beitritt_anfragen(v, null); r := r||'15c FEHLER doppelt; ';
  exception when others then r := r||'15c zweite Anfrage abgelehnt; '; end;
  begin perform beitrittsanfrage_entscheiden(anf, true, null); r := r||'15e FEHLER F nimmt selbst an; ';
  exception when others then r := r||'15e F kann nicht selbst annehmen; '; end;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', uX, 'role','authenticated')::text, true);
  set local role authenticated;
  begin perform * from beitrittsanfragen_liste(v); r := r||'29a FEHLER fremder Admin sieht Anfragen; ';
  exception when others then r := r||'29a fremder Vereinsadmin sieht Anfragen nicht; '; end;
  select count(*) into n from vereins_beitrittsanfragen where verein_id = v; r := r||'29b fremder Admin Tabelle='||n||'; ';
  begin perform admin_verein_anlegen('Darf nicht', null); r := r||'29d FEHLER Vereinsadmin legt Verein an; ';
  exception when others then r := r||'29d Vereinsadmin kann keine Vereine anlegen; '; end;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', uV, 'role','authenticated')::text, true);
  set local role authenticated;
  perform beitrittsanfrage_entscheiden(anf, true, null);
  begin perform admin_vereinslizenz_setzen(v, current_date, 12, 0, 'active'); r := r||'29e FEHLER Vereinsadmin setzt Lizenz; ';
  exception when others then r := r||'29e Vereinsadmin kann Lizenz nicht setzen; '; end;
  reset role;
  select r2.name||'/'||vm.aufnahme_status into t from vereins_mitglieder vm join rollen r2 on r2.id = vm.rolle_id where vm.user_id = uF; r := r||'16b F aufgenommen als '||coalesce(t,'-')||'; ';
  perform set_config('request.jwt.claims', json_build_object('sub', uP, 'role','authenticated')::text, true);
  set local role authenticated;
  perform admin_vereinslizenz_beenden(v); r := r||'L beendet -> Lizenz='||verein_hat_lizenz(v)::text||'; ';
  reset role;
  raise exception 'ERGEBNIS:%', r;
end $$;
