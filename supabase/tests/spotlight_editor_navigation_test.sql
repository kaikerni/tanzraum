-- Spotlight-Editor (Ebenen, Video, Musik, Erwaehnungen, Hashtags, Seiten) und persoenliche Navigation (Rollback-Test).
-- Eine Transaktion, endet mit raise exception 'ERGEBNIS:...' -> alles wird zurueckgerollt. auth.users bleibt unberuehrt.
do $$
declare
  uF uuid := gen_random_uuid(); uB uuid := gen_random_uuid(); uL uuid := gen_random_uuid(); uK uuid := gen_random_uuid();
  uP uuid := gen_random_uuid(); uA uuid := gen_random_uuid();
  r text := ''; t text; n int; s uuid; s2 uuid; story uuid := gen_random_uuid(); mt uuid := gen_random_uuid(); j jsonb;
  eb jsonb;
begin
  alter table benachrichtigungen drop constraint benachrichtigungen_user_id_fkey;
  alter table spotlights drop constraint spotlights_user_id_fkey;
  alter table musik_titel drop constraint musik_titel_user_id_fkey;
  alter table profiles drop constraint profiles_id_fkey;
  insert into profiles (id, vorname, nachname, geschlecht, geburtsdatum, tarif, tarif_aktiv_bis, konto_privat) values
    (uF, 'Fiona', 'Frei', 'w', '1990-01-01', 'free', null, false),
    (uB, 'Bea', 'Basic', 'w', '1991-01-01', 'basic', now() + interval '1 year', false),
    (uL, 'Lisa', 'Leser', 'w', '1992-01-01', 'basic', now() + interval '1 year', false),
    (uK, 'Kim', 'Kind', 'w', (current_date - interval '14 years')::date, 'basic', now() + interval '1 year', false),
    (uP, 'Paula', 'Privat', 'w', '1993-01-01', 'free', null, true),
    (uA, 'Ada', 'Admin', 'w', '1985-01-01', 'free', null, false);
  update profiles set ist_plattform_admin = true where id = uA;
  update plattform_einstellungen set spotlights_aktiv = true, spotlights_tarife = array['free', 'basic', 'verein'], musik_aktiv = false where id;
  insert into storage.buckets (id, name) values ('spotlights', 'spotlights'), ('musik', 'musik') on conflict do nothing;

  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', uF, 'role', 'authenticated')::text, true);
  begin perform spotlight_veroeffentlichen(null, 'text', 'rot', 'netzwerk', '[{"typ":"text","text":"Hallo"}]', null, null); r := r || 'F1 FEHLER FREE erstellt; ';
  exception when others then r := r || 'F1 FREE erstellt nicht; '; end;

  -- BASIC: Text-Story mit allen Ebenenarten
  perform set_config('request.jwt.claims', json_build_object('sub', uB, 'role', 'authenticated')::text, true);
  eb := jsonb_build_array(
    jsonb_build_object('typ', 'text', 'text', 'Training heute! #Gardetanz #TanzRaum #gardetanz', 'x', 0.5, 'y', 0.3, 'skala', 1.4, 'drehung', -12, 'stil', 'neon', 'farbe', '#ffcc00'),
    jsonb_build_object('typ', 'sticker', 'sticker', 't01', 'x', 0.2, 'y', 0.8, 'skala', 2, 'drehung', 15),
    jsonb_build_object('typ', 'sticker', 'sticker', '<script>', 'x', 0.2, 'y', 0.8),
    jsonb_build_object('typ', 'emoji', 'emoji', '🔥', 'x', 9, 'y', -5, 'skala', 99, 'drehung', 5000),
    jsonb_build_object('typ', 'standort', 'ort', 'Sporthalle Nord, Mannheim', 'lat', 49.1, 'lng', 8.4),
    jsonb_build_object('typ', 'erwaehnung', 'user_id', uL, 'name', 'Gefälschter Name'),
    jsonb_build_object('typ', 'erwaehnung', 'user_id', uK),
    jsonb_build_object('typ', 'zeichnung', 'striche', jsonb_build_array(jsonb_build_object('farbe', '#e11d2e', 'breite', 0.02, 'punkte', '[[0.1,0.1],[0.5,0.5],[2,2]]'::jsonb))),
    jsonb_build_object('typ', 'unbekannt', 'x', 0.1));
  s := spotlight_veroeffentlichen(null, 'text', 'gold', 'netzwerk', eb, null, story);
  reset role;
  select jsonb_agg(x->>'typ') into j from spotlights, jsonb_array_elements(spotlights.ebenen) x where id = s;
  r := r || 'B1 Ebenen=' || j::text || '; ';
  select x::text into t from spotlights, jsonb_array_elements(spotlights.ebenen) x where id = s and x->>'typ' = 'emoji';
  r := r || 'B2 Emoji begrenzt=' || t || '; ';
  select x->>'name' into t from spotlights, jsonb_array_elements(spotlights.ebenen) x where id = s and x->>'typ' = 'erwaehnung';
  r := r || 'B3 Erwaehnung Name serverseitig=' || t || '; ';
  select x::text into t from spotlights, jsonb_array_elements(spotlights.ebenen) x where id = s and x->>'typ' = 'standort';
  r := r || 'B4 Standort ohne Koordinaten=' || (t not like '%lat%')::text || '; ';
  select array_to_string(hashtags, ',') || ' / ' || coalesce(text_overlay, '-') into t from spotlights where id = s;
  r := r || 'B5 Hashtags/Text=' || t || '; ';
  select count(*) into n from benachrichtigungen where user_id = uL and typ = 'spotlight_erwaehnung'; r := r || 'B6 Lisa benachrichtigt=' || n || '; ';
  select count(*) into n from benachrichtigungen where user_id = uK; r := r || 'B7 Kind nicht benachrichtigt=' || n || '; ';
  set local role authenticated;
  -- Zweite Seite derselben Story (Video), Datei muss existieren
  begin perform spotlight_veroeffentlichen(uB || '/fehlt.mp4', 'video', null, 'netzwerk', '[]', null, story); r := r || 'B8 FEHLER ohne Datei; ';
  exception when others then r := r || 'B8 Datei fehlt abgelehnt; '; end;
  reset role;
  insert into storage.objects (bucket_id, name, owner) values ('spotlights', uB || '/seite2.mp4', uB);
  set local role authenticated;
  s2 := spotlight_veroeffentlichen(uB || '/seite2.mp4', 'video', null, 'netzwerk', '[{"typ":"text","text":"Seite 2"}]', null, story);
  begin perform spotlight_veroeffentlichen('fremd/x.jpg', 'foto', null, 'netzwerk', '[]', null, null); r := r || 'B9 FEHLER fremder Pfad; ';
  exception when others then r := r || 'B9 fremder Pfad abgelehnt; '; end;
  -- Musik: Bereich aus -> abgelehnt
  begin perform spotlight_veroeffentlichen(null, 'text', 'rot', 'netzwerk', '[{"typ":"text","text":"Mit Musik"}]', jsonb_build_object('titel_id', mt), null);
    r := r || 'B10 FEHLER Musik trotz aus; ';
  exception when others then r := r || 'B10 Musik aus: ' || sqlerrm || '; '; end;
  reset role;
  update plattform_einstellungen set musik_aktiv = true where id;
  insert into musik_titel (id, user_id, titel, interpret, art, datei_pfad, hochgeladen) values (mt, uB, 'Gardemarsch', 'Kapelle', 'training', 'nutzer/' || uB || '/marsch.mp3', true);
  set local role authenticated;
  s := spotlight_veroeffentlichen(null, 'text', 'rot', 'netzwerk', '[{"typ":"text","text":"Mit Musik"}]',
                                  jsonb_build_object('titel_id', mt, 'start', 42, 'dauer', 99, 'lautstaerke', 3), null);
  reset role; select musik::text into t from spotlights where id = s; set local role authenticated;
  r := r || 'B11 Musik=' || t || '; ';
  select count(*) into n from spotlight_musik_auswahl(); r := r || 'B12 Musikauswahl=' || n || '; ';

  -- Lisa (BASIC) sieht die Story inkl. Ebenen und darf die Musik hoeren
  perform set_config('request.jwt.claims', json_build_object('sub', uL, 'role', 'authenticated')::text, true);
  select count(*) into n from spotlights_von(uB); r := r || 'B13 Lisa sieht Seiten=' || n || '; ';
  select (musik ? 'titel_id')::text into t from spotlights_von(uB) where musik is not null; r := r || 'B14 titel_id verborgen=' || (t = 'false')::text || '; ';
  r := r || 'B15 Lisa Musik hoerbar=' || spotlight_musik_sichtbar('nutzer/' || uB || '/marsch.mp3') || '; ';
  begin perform spotlight_veroeffentlichen(null, 'text', 'rot', 'netzwerk', '[{"typ":"text","text":"x"}]', jsonb_build_object('titel_id', mt), null);
    r := r || 'B16 FEHLER fremde Musik; ';
  exception when others then r := r || 'B16 fremde Musik abgelehnt; '; end;
  -- FREE sieht (Spotlights fuer FREE eingeschaltet) und hoert
  perform set_config('request.jwt.claims', json_build_object('sub', uF, 'role', 'authenticated')::text, true);
  select count(*) into n from spotlights_von(uB); r := r || 'F2 FREE sieht=' || n || '; ';

  -- Kind: Sichtbarkeit wird auf Kontakte gesetzt
  perform set_config('request.jwt.claims', json_build_object('sub', uK, 'role', 'authenticated')::text, true);
  s := spotlight_veroeffentlichen(null, 'text', 'rot', 'netzwerk', '[{"typ":"text","text":"Kind"}]', null, null);
  reset role;
  select sichtbarkeit into t from spotlights where id = s; r := r || 'J1 Kind Sichtbarkeit=' || t || '; ';
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', uL, 'role', 'authenticated')::text, true);
  select count(*) into n from spotlights_von(uK); r := r || 'J2 Fremde sehen Kind=' || n || '; ';

  -- ===== Persoenliche Navigation =====
  perform set_config('request.jwt.claims', json_build_object('sub', uF, 'role', 'authenticated')::text, true);
  r := r || 'N1 Standard=' || coalesce(array_to_string(meine_navigation(), ','), 'NULL') || '; ';
  perform navigation_speichern(array['/dashboard/nachrichten', '/dashboard', 'javascript:alert(1)', '/juryraum/dashboard', '/dashboard', 'DROP TABLE', '/dashboard/spotlight']);
  r := r || 'N2 gespeichert=' || array_to_string(meine_navigation(), ',') || '; ';
  perform set_config('request.jwt.claims', json_build_object('sub', uB, 'role', 'authenticated')::text, true);
  r := r || 'N3 andere Person unberuehrt=' || coalesce(array_to_string(meine_navigation(), ','), 'NULL') || '; ';
  perform set_config('request.jwt.claims', json_build_object('sub', uF, 'role', 'authenticated')::text, true);
  perform navigation_speichern(null);
  r := r || 'N4 zurueckgesetzt=' || coalesce(array_to_string(meine_navigation(), ','), 'NULL') || '; ';
  r := r || 'N5 Tarif unveraendert=' || mein_tarif() || ', JuryRaum=' || juryraum_fuer_mich() || '; ';

  raise exception 'ERGEBNIS:%', r;
end $$;
