-- Benutzerliste der TanzRaum-Administration (Rollback-Test). Endet mit raise exception 'ERGEBNIS:...'.
create function pg_temp.als(u uuid) returns void language plpgsql as $f$
begin
  perform set_config('request.jwt.claims', case when u is null then '' else json_build_object('sub', u, 'role', 'authenticated')::text end, true);
  perform set_config('request.jwt.claim.sub', coalesce(u::text, ''), true);
end $f$;

do $$
declare
  uA uuid := gen_random_uuid();  -- TanzRaum-Admin
  uF uuid := gen_random_uuid();  -- FREE
  uB uuid := gen_random_uuid();  -- BASIC (bezahlt)
  uM uuid := gen_random_uuid();  -- BASIC kostenlos manuell
  uV uuid := gen_random_uuid();  -- Vereinsadmin, Verein mit Lizenz
  uT uuid := gen_random_uuid();  -- Trainerin im Verein
  uS uuid := gen_random_uuid();  -- gesperrt
  v1 uuid := gen_random_uuid();
  r text := ''; j jsonb; n int; alle int; t text;
  f text := 'zbltest';  -- gemeinsamer Suchbegriff (nur Testkonten)
begin
  insert into auth.users (id, email, email_confirmed_at, created_at) values
    (uA, 'admin.zbltest@tanzraum.test', now(), now() - interval '7 day'),
    (uF, 'free.zbltest@beispiel.test', now(), now() - interval '6 day'),
    (uB, 'basic.zbltest@beispiel.test', now(), now() - interval '5 day'),
    (uM, 'manuell.zbltest@beispiel.test', now(), now() - interval '4 day'),
    (uV, 'vadmin.zbltest@beispiel.test', now(), now() - interval '3 day'),
    (uT, 'trainer.zbltest@beispiel.test', now(), now() - interval '2 day'),
    (uS, 'gesperrt.zbltest@beispiel.test', now(), now() - interval '1 day');
  insert into profiles (id, vorname, nachname, handle, geschlecht, geburtsdatum, tarif) values
    (uA, 'Ada', 'Admin', 'zbltest_ada', 'w', '1985-01-01', 'free'), (uF, 'Fritz', 'Free', 'zbltest_fritz', 'm', '1990-01-01', 'free'),
    (uB, 'Bea', 'Basic', 'zbltest_bea', 'w', '1990-01-01', 'free'), (uM, 'Max', 'Manuell', 'zbltest_max', 'm', '1990-01-01', 'free'),
    (uV, 'Vera', 'Vorstand', 'zbltest_vera', 'w', '1980-01-01', 'free'), (uT, 'Tina', 'Trainer', 'zbltest_tina', 'w', '1992-01-01', 'free'),
    (uS, 'Sam', 'Sperre', 'zbltest_sam', 'm', '1990-01-01', 'free')
  on conflict (id) do update set vorname = excluded.vorname, nachname = excluded.nachname, handle = excluded.handle;
  update profiles set ist_plattform_admin = true where id = uA;
  update profiles set gesperrt = true where id = uS;
  insert into abos (inhaber, user_id, tarif, periode, preis_cent, anbieter, status) values ('person', uB, 'basic', 'jahr', 2990, 'stripe', 'active');
  perform tarif_neu_berechnen_person(uB, 'test');
  insert into abos (inhaber, user_id, tarif, periode, preis_cent, anbieter, status, freischaltung) values ('person', uM, 'basic', 'unbefristet', 0, 'manuell', 'active', 'manual_free');
  perform tarif_neu_berechnen_person(uM, 'test');
  insert into vereine (id, name) values (v1, 'ZBL Tanzclub');
  insert into vereins_mitglieder (user_id, verein_id, rolle_id) values (uV, v1, (select id from rollen where name = 'Vereins-Admin'));
  insert into abos (inhaber, user_id, verein_id, tarif, periode, preis_cent, anbieter, status) values ('verein', uV, v1, 'verein', 'jahr', 0, 'manuell', 'active');
  perform tarif_neu_berechnen_verein(v1, 'test');
  insert into vereins_mitglieder (user_id, verein_id, rolle_id) values (uT, v1, (select id from rollen where name = 'Trainerin'));
  -- Vereinsmitglieder OHNE TanzRaum-Konto (nur Mitgliederverwaltung)
  insert into mitglieder (verein_id, vorname, nachname) values (v1, 'Ohne', 'Konto1'), (v1, 'Ohne', 'Konto2');
  select count(*) into alle from profiles p join auth.users u on u.id = p.id;

  set local role authenticated;

  -- Rechte
  perform pg_temp.als(uF);
  begin perform admin_benutzer_liste(); r := r || 'B1 FEHLER FREE sieht Liste; ';
  exception when others then r := r || 'B1 FREE abgewiesen; '; end;
  perform pg_temp.als(uV);
  begin perform admin_benutzer_liste(); r := r || 'B2 FEHLER Vereinsadmin sieht Liste; ';
  exception when others then r := r || 'B2 Vereinsadmin abgewiesen; '; end;
  reset role;
  r := r || format('B3 anon darf nicht: %s; ', not has_function_privilege('anon', 'public.admin_benutzer_liste(text,text,text,uuid,text,text,boolean,integer,integer)', 'execute'));
  set local role authenticated;

  perform pg_temp.als(uA);
  j := admin_benutzer_liste();
  r := r || format('B4 Admin: gesamt=%s (Konten %s), Seite %s mit %s Zeilen; ', j ->> 'gesamt', alle, j ->> 'seite', jsonb_array_length(j -> 'zeilen'));
  r := r || format('B5 neueste zuerst: %s; ', (j -> 'zeilen' -> 0 ->> 'user_id') = uS::text);
  j := admin_benutzer_liste(f);
  r := r || format('B6 Suche „%s“: %s Treffer (7 Konten, ohne 2 Mitglieder ohne Konto); ', f, j ->> 'gesamt');
  select string_agg((z ->> 'handle') || '=' || (z ->> 'tarif') || coalesce('/' || (z ->> 'lizenzart'), '') || case when (z ->> 'manuell')::boolean then '/manuell' else '' end, ',' order by z ->> 'handle')
    into t from jsonb_array_elements(j -> 'zeilen') z;
  r := r || 'B7 Tarife: ' || t || '; ';
  j := admin_benutzer_liste(f, 'free');
  r := r || format('B8 Filter FREE: %s; ', (select string_agg(z ->> 'handle', ',' order by z ->> 'handle') from jsonb_array_elements(j -> 'zeilen') z));
  j := admin_benutzer_liste(f, 'basic');
  r := r || format('B9 Filter BASIC: %s; ', (select string_agg(z ->> 'handle', ',' order by z ->> 'handle') from jsonb_array_elements(j -> 'zeilen') z));
  j := admin_benutzer_liste(f, 'verein');
  r := r || format('B10 Filter VEREIN: %s; ', (select string_agg(z ->> 'handle', ',' order by z ->> 'handle') from jsonb_array_elements(j -> 'zeilen') z));
  j := admin_benutzer_liste(null, null, null, v1);
  r := r || format('B11 Filter Verein: %s; ', (select string_agg((z ->> 'handle') || '(' || (z ->> 'rolle_typ') || ')', ',' order by z ->> 'handle') from jsonb_array_elements(j -> 'zeilen') z));
  j := admin_benutzer_liste(f, null, null, null, 'trainer');
  r := r || format('B12 Filter Rolle Trainer: %s; ', (select string_agg(z ->> 'handle', ',') from jsonb_array_elements(j -> 'zeilen') z));
  j := admin_benutzer_liste(f, null, 'deaktiviert');
  r := r || format('B13 Status deaktiviert: %s; ', (select string_agg(z ->> 'handle', ',') from jsonb_array_elements(j -> 'zeilen') z));
  j := admin_benutzer_liste(f, null, 'aktiv');
  r := r || format('B14 Status aktiv: %s Treffer; ', j ->> 'gesamt');
  j := admin_benutzer_liste('ZBL Tanz');
  r := r || format('B15 Suche nach Verein: %s Treffer; ', j ->> 'gesamt');
  j := admin_benutzer_liste('basic.zbltest@');
  r := r || format('B16 Suche nach E-Mail: %s, E-Mail gekürzt: %s; ', j -> 'zeilen' -> 0 ->> 'handle', j -> 'zeilen' -> 0 ->> 'email_maskiert');
  j := admin_benutzer_liste('z');
  r := r || format('B17 1 Zeichen = keine Suche: gesamt=%s; ', j ->> 'gesamt');
  -- Sortierung + Seiten
  j := admin_benutzer_liste(f, null, null, null, null, 'name', false, 1, 20);
  r := r || format('B18 Name A–Z: %s; ', (select string_agg(z.e ->> 'nachname', ',' order by z.i) from jsonb_array_elements(j -> 'zeilen') with ordinality z(e, i)));
  j := admin_benutzer_liste(f, null, null, null, null, 'handle', true, 1, 20);
  r := r || format('B19 @Name Z–A erster: %s; ', j -> 'zeilen' -> 0 ->> 'handle');
  j := admin_benutzer_liste(null, null, null, null, null, 'registriert', true, 2, 20);
  r := r || format('B20 Seite 2 à 20: %s Zeilen, gesamt %s; ', jsonb_array_length(j -> 'zeilen'), j ->> 'gesamt');
  j := admin_benutzer_liste(f, null, null, null, null, 'registriert', true, 1, 7);
  r := r || format('B21 ungültige Seitengröße → %s; ', j ->> 'pro_seite');
  r := r || format('B22 Vereinsliste für Filter enthält ZBL: %s; ', exists (select 1 from jsonb_array_elements(j -> 'vereine') v where v ->> 'name' = 'ZBL Tanzclub'));
  r := r || format('B23 keine Chat-/Privatfelder: %s; ', not exists (select 1 from jsonb_array_elements(admin_benutzer_liste(f) -> 'zeilen') z, jsonb_object_keys(z) k
    where k in ('email', 'telefon', 'geburtsdatum', 'map_lat', 'map_lng', 'nachrichten', 'inhalt')));

  raise exception 'ERGEBNIS: %', r;
end $$;
