-- Konto loeschen durch die TanzRaum-Administration (Rollback-Test). Endet mit raise exception 'ERGEBNIS:...'.
-- Lokale Testdatenbank: vault.secrets ist dort eine einfache Tabelle, net.http_post ein Platzhalter.
create function pg_temp.als(u uuid) returns void language plpgsql as $f$
begin
  perform set_config('request.jwt.claims', case when u is null then '' else json_build_object('sub', u, 'role', 'authenticated')::text end, true);
  perform set_config('request.jwt.claim.sub', coalesce(u::text, ''), true);
end $f$;

do $$
declare
  uA uuid := gen_random_uuid();  -- TanzRaum-Admin
  uM uuid := gen_random_uuid();  -- BASIC kostenlos manuell, unbefristet, kein Verein (Fall aus dem Screenshot)
  uP uuid := gen_random_uuid();  -- BASIC bezahlt (Stripe), laufend
  uK uuid := gen_random_uuid();  -- BASIC bezahlt, gekuendigt, mit Rechnung
  uV uuid := gen_random_uuid();  -- Vereinsmitglied
  uT uuid := gen_random_uuid();  -- Team-Freischaltung
  v1 uuid := gen_random_uuid();
  r text := ''; j jsonb; b boolean; v_rech uuid;
begin
  insert into auth.users (id, email, email_confirmed_at) values
    (uA, 'a.kl@tanzraum.test', now()), (uM, 'm.kl@beispiel.test', now()), (uP, 'p.kl@beispiel.test', now()),
    (uK, 'k.kl@beispiel.test', now()), (uV, 'v.kl@beispiel.test', now()), (uT, 't.kl@beispiel.test', now());
  insert into profiles (id, vorname, nachname, handle, geschlecht, geburtsdatum, tarif) values
    (uA, 'Ada', 'Admin', 'kl_ada', 'w', '1985-01-01', 'free'), (uM, 'Max', 'Manuell', 'kl_max', 'm', '1990-01-01', 'free'),
    (uP, 'Pia', 'Bezahlt', 'kl_pia', 'w', '1990-01-01', 'free'), (uK, 'Kai', 'Gekuendigt', 'kl_kai', 'm', '1990-01-01', 'free'),
    (uV, 'Vera', 'Verein', 'kl_vera', 'w', '1990-01-01', 'free'), (uT, 'Tom', 'Team', 'kl_tom', 'm', '1990-01-01', 'free')
  on conflict (id) do update set vorname = excluded.vorname, nachname = excluded.nachname, handle = excluded.handle;
  update profiles set ist_plattform_admin = true where id = uA;
  insert into abos (inhaber, user_id, tarif, periode, preis_cent, anbieter, status, freischaltung) values
    ('person', uM, 'basic', 'unbefristet', 0, 'manuell', 'active', 'manual_free'),
    ('person', uT, 'basic', 'unbefristet', 0, 'manuell', 'active', 'team_free');
  insert into abos (inhaber, user_id, tarif, periode, preis_cent, anbieter, status) values ('person', uP, 'basic', 'jahr', 2990, 'stripe', 'active');
  insert into abos (inhaber, user_id, tarif, periode, preis_cent, anbieter, status, gekuendigt_zum, laeuft_bis)
    values ('person', uK, 'basic', 'jahr', 2990, 'stripe', 'cancelled', now() + interval '20 days', now() + interval '20 days');
  insert into rechnungs_einstellungen (id) values (true) on conflict do nothing;
  v_rech := erstelle_rechnung('basic', uK, null, 'basic', 'jahr', 29.90, 'karte/lastschrift (stripe)');
  insert into vereine (id, name) values (v1, 'KL Verein');
  insert into vereins_mitglieder (user_id, verein_id, rolle_id) values (uV, v1, (select id from rollen where name = 'Tänzerin'));
  insert into vault.secrets (name, secret) values ('chat_push_geheimnis', 'testgeheimnis');
  grant select on admin_konto_aktionen to authenticated;

  set local role authenticated;
  perform pg_temp.als(uM);
  begin perform admin_konto_loeschung_pruefen(uP); r := r || 'K1 FEHLER Nutzer prueft; ';
  exception when others then r := r || 'K1 Prüfung nur TanzRaum-Admin; '; end;

  perform pg_temp.als(uA);
  -- Fall aus dem Screenshot
  j := admin_konto_loeschung_pruefen(uM);
  r := r || format('K2 manuell BASIC: Hindernisse=%s, Hinweis=%s; ', jsonb_array_length(j -> 'hindernisse'), j -> 'hinweise' ->> 0);
  j := admin_konto_loeschung_pruefen(uT);
  r := r || format('K3 Team-Freischaltung: Hindernisse=%s; ', jsonb_array_length(j -> 'hindernisse'));
  j := admin_konto_loeschung_pruefen(uP);
  r := r || format('K4 bezahlt laufend: %s; ', j -> 'hindernisse' ->> 0);
  j := admin_konto_loeschung_pruefen(uV);
  r := r || format('K5 Vereinsmitglied: %s; ', left(j -> 'hindernisse' ->> 0, 50));
  j := admin_konto_loeschung_pruefen(uK);
  r := r || format('K6 gekündigt + Rechnung: Hindernisse=%s, Hinweis=%s; ', jsonb_array_length(j -> 'hindernisse'), j -> 'hinweise' ->> 0);
  begin perform admin_konto_loeschen(uP, 'Test', true); r := r || 'K7 FEHLER bezahltes Abo geloescht; ';
  exception when others then r := r || 'K7 bezahlt laufend weiter blockiert; '; end;
  begin perform admin_konto_loeschen(uM, '', true); r := r || 'K8 FEHLER ohne Grund; ';
  exception when others then r := r || 'K8 Grund ist Pflicht (auch serverseitig); '; end;
  -- Sofort endgueltig: Sperre + Faelligkeit, dann der bestehende Loeschlauf (konto-loeschung -> konto_endgueltig_loeschen)
  perform admin_konto_loeschen(uM, 'Wunsch per E-Mail', true);
  perform admin_konto_loeschen(uK, 'Wunsch per E-Mail', true);
  perform admin_konto_loeschen(uT, 'Wunsch per E-Mail', true);
  reset role;
  r := r || format('K9 gesperrt + fällig: %s; ', (select bool_and(u.banned_until > now()) from auth.users u where u.id in (uM, uK, uT))
    and (select count(*) from konto_loeschungen k where k.user_id in (uM, uK, uT) and k.loeschen_ab <= now()) = 3);
  b := konto_endgueltig_loeschen('testgeheimnis', uM);
  r := r || format('K10 endgültig gelöscht (manuell BASIC): %s, Konto weg=%s, Abo weg=%s; ', b,
    not exists (select 1 from auth.users where id = uM), not exists (select 1 from abos where user_id = uM));
  b := konto_endgueltig_loeschen('testgeheimnis', uK);
  r := r || format('K11 gelöscht mit gekündigtem Abo: %s, Rechnung erhalten=%s (Kontobezug entfernt=%s); ', b,
    exists (select 1 from rechnungen where id = v_rech), (select ziel_user_id is null from rechnungen where id = v_rech));
  b := konto_endgueltig_loeschen('testgeheimnis', uT);
  r := r || format('K12 Team-Freischaltung gelöscht: %s; ', b);
  begin b := konto_endgueltig_loeschen('falsch', uP); r := r || 'K13 FEHLER falsches Geheimnis; ';
  exception when others then r := r || 'K13 interner Löschlauf nur mit Geheimnis; '; end;
  -- andere Konten unberuehrt
  r := r || format('K14 andere Konten unberührt: %s; ', (select count(*) from auth.users where id in (uA, uP, uV)) = 3);
  raise exception 'ERGEBNIS: %', r;
end $$;
