-- Online-Status: Standard AN, AUS fuer normale Nutzer unsichtbar, Administration sieht die Einstellung (Rollback-Test).
-- Endet mit raise exception 'ERGEBNIS:...'.
create function pg_temp.als(u uuid) returns void language plpgsql as $f$
begin
  perform set_config('request.jwt.claims', case when u is null then '' else json_build_object('sub', u, 'role', 'authenticated')::text end, true);
  perform set_config('request.jwt.claim.sub', coalesce(u::text, ''), true);
end $f$;

do $$
declare
  uAdm uuid := gen_random_uuid();  -- TanzRaum-Admin
  uA uuid := gen_random_uuid();    -- Online-Status AN, gerade online
  uB uuid := gen_random_uuid();    -- Online-Status AUS, gerade aktiv
  uC uuid := gen_random_uuid();    -- Online-Status AN, offline
  uN uuid := gen_random_uuid();    -- normaler BASIC-Nutzer (Betrachter)
  r text := ''; j jsonb; n int;
  f text := 'ostest';
begin
  insert into auth.users (id, email, email_confirmed_at) values
    (uAdm, 'adm.ostest@tanzraum.test', now()), (uA, 'a.ostest@beispiel.test', now()), (uB, 'b.ostest@beispiel.test', now()),
    (uC, 'c.ostest@beispiel.test', now()), (uN, 'n.ostest@beispiel.test', now());
  insert into profiles (id, vorname, nachname, handle, geschlecht, geburtsdatum) values
    (uAdm, 'Ada', 'Admin', 'ostest_ada', 'w', '1985-01-01'), (uA, 'Anna', 'An', 'ostest_anna', 'w', '1990-01-01'),
    (uB, 'Bert', 'Aus', 'ostest_bert', 'm', '1990-01-01'), (uC, 'Cleo', 'Offline', 'ostest_cleo', 'w', '1990-01-01'),
    (uN, 'Nora', 'Normal', 'ostest_nora', 'w', '1990-01-01')
  on conflict (id) do update set vorname = excluded.vorname, nachname = excluded.nachname, handle = excluded.handle, geburtsdatum = excluded.geburtsdatum;
  r := r || format('O1 neue Konten Standard AN: %s; ', (select bool_and(online_sichtbar) from profiles where id in (uA, uB, uC, uN)));
  update profiles set ist_plattform_admin = true where id = uAdm;
  insert into abos (inhaber, user_id, tarif, periode, preis_cent, anbieter, status, freischaltung) values ('person', uN, 'basic', 'unbefristet', 0, 'manuell', 'active', 'manual_free');
  perform tarif_neu_berechnen_person(uN, 'test');
  update profiles set zuletzt_online = now() where id in (uA, uB, uN);
  update profiles set zuletzt_online = now() - interval '2 hours' where id = uC;

  set local role authenticated;
  -- B schaltet den Online-Status selbst aus
  perform pg_temp.als(uB);
  perform online_sichtbar_setzen(false);

  -- normale Nutzerin
  perform pg_temp.als(uN);
  n := online_anzahl();
  r := r || format('O2 Zähler für Nutzer: %s (Anna + Nora, ohne Bert mit AUS); ', n);
  j := online_liste(null);
  r := r || format('O3 Online-Liste für Nutzer: %s; ', (select string_agg(e ->> 'name', ', ' order by e ->> 'name') from jsonb_array_elements(j -> 'personen') e));
  r := r || format('O4 Übersicht gesamt: %s; ', online_uebersicht() ->> 'gesamt');
  begin perform admin_benutzer_liste(f); r := r || 'O5 FEHLER Nutzer sieht Admin-Liste; ';
  exception when others then r := r || 'O5 Admin-Liste für Nutzer gesperrt; '; end;
  begin perform admin_plattform_statistik(); r := r || 'O6 FEHLER Nutzer sieht Statistik; ';
  exception when others then r := r || 'O6 Statistik für Nutzer gesperrt; '; end;

  -- TanzRaum-Admin
  perform pg_temp.als(uAdm);
  j := admin_benutzer_liste(f, null, null, null, null, 'name', false, 1, 20);
  r := r || format('O7 Admin sieht alle: %s; ', (select string_agg((e ->> 'vorname') || '=' || (e ->> 'online_status'), ', ' order by e ->> 'vorname') from jsonb_array_elements(j -> 'zeilen') e));
  j := admin_benutzer_liste(f, null, 'online_aus');
  r := r || format('O8 Filter Online-Status AUS: %s; ', (select string_agg(e ->> 'vorname', ', ') from jsonb_array_elements(j -> 'zeilen') e));
  j := admin_benutzer_liste(f, null, 'online');
  r := r || format('O9 Filter gerade online: %s; ', (select string_agg(e ->> 'vorname', ', ' order by e ->> 'vorname') from jsonb_array_elements(j -> 'zeilen') e));
  j := admin_plattform_statistik();
  r := r || format('O10 Statistik: online_jetzt=%s (ohne Bert), online_aus=%s; ', j ->> 'online_jetzt', j ->> 'online_aus');
  r := r || format('O11 Admin-Zähler: %s; ', online_anzahl());
  -- Admin kann die Einstellung anderer nicht ueberschreiben
  begin
    update profiles set online_sichtbar = true where id = uB;
  exception when others then null; end;
  perform online_sichtbar_setzen(true);  -- wirkt nur auf das eigene Konto
  reset role;
  r := r || format('O12 Admin kann AUS nicht überschreiben: %s; ', not (select online_sichtbar from profiles where id = uB));

  -- B schaltet wieder an
  set local role authenticated;
  perform pg_temp.als(uB);
  perform online_sichtbar_setzen(true);
  perform pg_temp.als(uN);
  r := r || format('O13 Bert wieder AN → Zähler: %s, in Liste: %s; ', online_anzahl(),
    exists (select 1 from jsonb_array_elements(online_liste(null) -> 'personen') e where e ->> 'name' like 'Bert%'));
  reset role;
  raise exception 'ERGEBNIS: %', r;
end $$;
