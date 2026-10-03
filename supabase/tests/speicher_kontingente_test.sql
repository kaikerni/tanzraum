-- Zentrale Speicherkontingente (Rollback-Test). Eine Transaktion, endet mit raise exception 'ERGEBNIS:...'.
-- Testkonten und -dateien entstehen nur in dieser Transaktion (lokale Testdatenbank).
do $$
declare
  uA uuid := gen_random_uuid();   -- TanzRaum-Admin
  uAA uuid := gen_random_uuid();  -- Vereinsadmin A
  uB uuid := gen_random_uuid();   -- BASIC-Nutzerin
  uF uuid := gen_random_uuid();   -- FREE-Nutzer
  vA uuid := gen_random_uuid();
  admin_r uuid := (select id from rollen where name = 'Vereins-Admin');
  r text := ''; t text; n int; n2 int; b boolean; j jsonb; mb bigint := 1048576;
begin
  insert into auth.users (id, email, email_confirmed_at) values
    (uA, 'admin@tanzraum.test', now()), (uAA, 'a-admin@beispiel.test', now()), (uB, 'basic@beispiel.test', now()), (uF, 'free@beispiel.test', now());
  insert into profiles (id, vorname, nachname, handle, geschlecht, geburtsdatum, tarif) values
    (uA, 'Ada', 'Admin', 'ada_s', 'w', '1985-01-01', 'free'),
    (uAA, 'Anna', 'A-Admin', 'anna_s', 'w', '1980-01-01', 'free'),
    (uB, 'Bea', 'Basic', 'bea_s', 'w', '1990-01-01', 'basic'),
    (uF, 'Fritz', 'Free', 'fritz_s', 'm', '1990-01-01', 'free')
  on conflict (id) do update set vorname = excluded.vorname, nachname = excluded.nachname, handle = excluded.handle, tarif = excluded.tarif;
  update profiles set ist_plattform_admin = true where id = uA;
  insert into vereine (id, name, tarif, tarif_aktiv_bis) values (vA, 'Verein Speicher Test', 'verein', null);
  insert into vereins_mitglieder (user_id, verein_id, rolle_id, aufnahme_status) values (uAA, vA, admin_r, 'aufgenommen');
  -- Gesamtspeicher fuer den Test grosszuegig (Ausgangslage unabhaengig von vorhandenen Testdateien)
  update plattform_einstellungen set speicher_gesamt_mb = 100000, spotlights_aktiv = true, spotlights_tarife = array['free', 'basic', 'verein'] where id;
  select count(*) into n2 from storage.objects;
  -- wie in Supabase: angemeldete Rollen duerfen storage.objects grundsaetzlich schreiben, die Regeln (RLS) entscheiden
  grant select, insert on storage.objects to authenticated;

  set local role authenticated;

  -- ===== Rechte =====
  perform set_config('request.jwt.claims', json_build_object('sub', uAA, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uAA::text, true);
  begin perform admin_speicher_speichern(100000, null, '[{"schluessel":"teamcloud_verein","limit_mb":99999}]'); r := r || 'S1 FEHLER Vereinsadmin aendert; ';
  exception when others then r := r || 'S1 Vereinsadmin kann globale Limits nicht aendern; '; end;
  begin perform admin_speicher_uebersicht(); r := r || 'S2 FEHLER Vereinsadmin sieht Uebersicht; ';
  exception when others then r := r || 'S2 Uebersicht nur TanzRaum-Admin; '; end;
  begin update speicher_kontingente set limit_mb = 99999; r := r || 'S3 FEHLER direkte Aenderung; ';
  exception when others then r := r || 'S3 Tabelle direkt gesperrt; '; end;
  begin update plattform_einstellungen set speicher_gesamt_mb = 1; r := r || 'S4 FEHLER Gesamt direkt; ';
  exception when others then r := r || 'S4 Gesamtspeicher direkt gesperrt; '; end;
  -- Vereinsadmin sieht den eigenen Verbrauch (bestehende Funktion)
  j := teamcloud_speicher(vA);
  r := r || 'S5 Verein sieht eigenen Speicher: limit=' || ((j ->> 'limit')::bigint / mb) || ' MB; ';

  -- ===== Admin setzt TeamCloud Verein auf 60 MB =====
  perform set_config('request.jwt.claims', json_build_object('sub', uA, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uA::text, true);
  perform admin_speicher_speichern(100000, 1024, '[{"schluessel":"teamcloud_verein","limit_mb":60}]');
  perform set_config('request.jwt.claims', json_build_object('sub', uAA, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uAA::text, true);
  -- ===== Upload innerhalb / ueber dem Limit =====
  j := teamcloud_upload_vorbereiten(vA, 'a.pdf', 40 * mb, 'application/pdf', '');
  reset role;
  insert into storage.objects (bucket_id, name, owner, owner_id, metadata) values ('vereins-dateien', j ->> 'pfad', uAA, uAA::text, jsonb_build_object('size', 40 * mb, 'mimetype', 'application/pdf'));
  set local role authenticated;
  perform teamcloud_upload_abschliessen((j ->> 'id')::uuid);
  r := r || 'S6 Upload innerhalb des Limits ok; ';
  begin perform teamcloud_upload_vorbereiten(vA, 'b.pdf', 30 * mb, 'application/pdf', ''); r := r || 'S7 FEHLER ueber Limit; ';
  exception when others then r := r || 'S7 ueber Limit blockiert: ' || sqlerrm || '; '; end;

  -- ===== Admin erhoeht: sofort wirksam =====
  perform set_config('request.jwt.claims', json_build_object('sub', uA, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uA::text, true);
  j := admin_speicher_speichern(100000, 1024, '[{"schluessel":"teamcloud_verein","limit_mb":2000},{"schluessel":"teamcloud_persoenlich","limit_mb":30}]');
  r := r || 'S8 gespeichert: ' || (j ->> 'aenderungen') || ' Aenderungen; ';
  r := r || 'S9 neu gelesen: verein=' || (select limit_mb from speicher_kontingente_oeffentlich() where schluessel = 'teamcloud_verein')
        || ' basic=' || (select limit_mb from speicher_kontingente_oeffentlich() where schluessel = 'teamcloud_persoenlich') || '; ';
  perform set_config('request.jwt.claims', json_build_object('sub', uAA, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uAA::text, true);
  j := teamcloud_upload_vorbereiten(vA, 'b.pdf', 30 * mb, 'application/pdf', '');
  r := r || 'S10 nach Erhoehung sofort hochladbar; ';
  reset role;
  delete from dateien where id = (j ->> 'id')::uuid; -- Reservierung wieder freigeben
  set local role authenticated;

  -- ===== BASIC: persoenliches Kontingent =====
  perform set_config('request.jwt.claims', json_build_object('sub', uB, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uB::text, true);
  j := teamcloud_speicher(null);
  r := r || 'S11 BASIC erhaelt ' || ((j ->> 'limit')::bigint / mb) || ' MB; ';
  begin perform teamcloud_upload_vorbereiten(null, 'g.zip', 40 * mb, 'application/zip', ''); r := r || 'S12 FEHLER BASIC ueber Limit; ';
  exception when others then r := r || 'S12 BASIC ueber Limit: ' || sqlerrm || '; '; end;
  perform set_config('request.jwt.claims', json_build_object('sub', uF, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uF::text, true);
  begin perform teamcloud_upload_vorbereiten(null, 'f.pdf', 1 * mb, 'application/pdf', ''); r := r || 'S13 FEHLER FREE laedt hoch; ';
  exception when others then r := r || 'S13 FREE ohne persoenliche TeamCloud; '; end;

  -- ===== Reduzieren: nichts wird geloescht, weitere Uploads gesperrt =====
  perform set_config('request.jwt.claims', json_build_object('sub', uA, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uA::text, true);
  perform admin_speicher_speichern(100000, 1024, '[{"schluessel":"teamcloud_verein","limit_mb":20}]');
  perform set_config('request.jwt.claims', json_build_object('sub', uAA, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uAA::text, true);
  j := teamcloud_speicher(vA);
  r := r || 'S14 nach Reduzierung: belegt=' || ((j ->> 'belegt')::bigint / mb) || ' MB, limit=' || ((j ->> 'limit')::bigint / mb) || ' MB, Dateien=' || (j ->> 'dateien') || '; ';
  begin perform teamcloud_upload_vorbereiten(vA, 'c.pdf', 1 * mb, 'application/pdf', ''); r := r || 'S15 FEHLER trotz Ueberschreitung; ';
  exception when others then r := r || 'S15 ueber neuem Limit: ' || sqlerrm || '; '; end;
  reset role;
  r := r || 'S16 Dateien unveraendert: ' || (select count(*) from storage.objects) - n2 || ' neue Datei(en) im Speicher, '
        || (select count(*) from dateien where verein_id = vA and hochgeladen) || ' Eintrag; ';
  set local role authenticated;

  -- ===== Bereich deaktiviert =====
  perform set_config('request.jwt.claims', json_build_object('sub', uA, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uA::text, true);
  perform admin_speicher_speichern(100000, 1024, '[{"schluessel":"teamcloud_persoenlich","limit_mb":250,"aktiv":false}]');
  perform set_config('request.jwt.claims', json_build_object('sub', uB, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uB::text, true);
  begin perform teamcloud_upload_vorbereiten(null, 'd.pdf', 1 * mb, 'application/pdf', ''); r := r || 'S17 FEHLER deaktiviert; ';
  exception when others then r := r || 'S17 deaktiviert: ' || sqlerrm || '; '; end;

  -- ===== Musik (zentral) =====
  perform set_config('request.jwt.claims', json_build_object('sub', uA, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uA::text, true);
  perform admin_speicher_speichern(100000, 1024, '[{"schluessel":"musik_persoenlich","limit_mb":5},{"schluessel":"teamcloud_persoenlich","limit_mb":250,"aktiv":true}]');
  perform set_config('request.jwt.claims', json_build_object('sub', uB, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uB::text, true);
  r := r || 'S18 Musik BASIC=' || ((musik_speicher(null) ->> 'limit')::bigint / mb) || ' MB; ';
  begin perform musik_upload_vorbereiten(null, 'Lied', 'lied.mp3', 6 * mb, 'audio/mpeg'); r := r || 'S19 FEHLER Musik ueber Limit; ';
  exception when others then r := r || 'S19 Musik ueber Limit: ' || sqlerrm || '; '; end;

  -- ===== Direkte Uploads (Speicherregel auf storage.objects): Spotlights =====
  perform set_config('request.jwt.claims', json_build_object('sub', uA, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uA::text, true);
  perform admin_speicher_speichern(100000, 1024, '[{"schluessel":"spotlights","limit_mb":10}]');
  perform set_config('request.jwt.claims', json_build_object('sub', uB, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uB::text, true);
  b := speicher_vorpruefung('spotlights', uB || '/x.jpg', 4 * mb);
  insert into storage.objects (bucket_id, name, owner, owner_id, metadata) values ('spotlights', uB || '/1.jpg', uB, uB::text, jsonb_build_object('size', 6 * mb));
  r := r || 'S20 direkter Upload innerhalb ok; ';
  begin perform speicher_vorpruefung('spotlights', uB || '/x.jpg', 8 * mb); r := r || 'S21 FEHLER Vorpruefung; ';
  exception when others then r := r || 'S21 Vorpruefung: ' || sqlerrm || '; '; end;
  insert into storage.objects (bucket_id, name, owner, owner_id, metadata) values ('spotlights', uB || '/2.jpg', uB, uB::text, jsonb_build_object('size', 5 * mb));
  begin
    insert into storage.objects (bucket_id, name, owner, owner_id, metadata) values ('spotlights', uB || '/3.jpg', uB, uB::text, jsonb_build_object('size', 1 * mb));
    r := r || 'S22 FEHLER Manipulation umgeht Limit; ';
  exception when others then r := r || 'S22 direkter API-Upload ueber Limit abgelehnt (' || sqlstate || '); '; end;
  -- fremde Belegung zaehlt nicht: andere Person darf weiter
  perform set_config('request.jwt.claims', json_build_object('sub', uAA, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uAA::text, true);
  r := r || 'S23 andere Person: ' || speicher_upload_erlaubt('spotlights', uAA || '/1.jpg') || '; ';

  -- ===== Gesamtspeicher voll =====
  perform set_config('request.jwt.claims', json_build_object('sub', uA, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uA::text, true);
  reset role;
  t := (speicher_gesamt_belegt() / mb + 1)::text;
  set local role authenticated;
  perform admin_speicher_speichern(t::int, 1024, '[]');
  j := admin_speicher_uebersicht();
  r := r || 'S24 Uebersicht: gesamt=' || (j ->> 'gesamt_mb') || ' MB, Prozent=' || round(100.0 * (j ->> 'belegt')::bigint / ((j ->> 'gesamt_mb')::bigint * mb)) || ', Bereiche=' || jsonb_array_length(j -> 'kategorien')
        || ', TeamCloud Verein belegt=' || ((select (x ->> 'belegt')::bigint from jsonb_array_elements(j -> 'kategorien') x where x ->> 'schluessel' = 'teamcloud_verein') / mb) || ' MB; ';
  perform set_config('request.jwt.claims', json_build_object('sub', uAA, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uAA::text, true);
  begin perform teamcloud_upload_vorbereiten(vA, 'e.pdf', 2 * mb, 'application/pdf', ''); r := r || 'S25 FEHLER Gesamt voll; ';
  exception when others then r := r || 'S25 Gesamt voll: ' || sqlerrm || '; '; end;
  begin perform admin_speicher_speichern(100000, null, '[]'); r := r || 'S26 FEHLER Vereinsadmin speichert; ';
  exception when others then r := r || 'S26 Vereinsadmin abgelehnt; '; end;
  -- 100 %: Gesamtspeicher genau auf die Belegung (abgerundet) setzen
  perform set_config('request.jwt.claims', json_build_object('sub', uA, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uA::text, true);
  perform admin_speicher_speichern(t::int - 1, 1024, '[]');
  perform set_config('request.jwt.claims', json_build_object('sub', uAA, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uAA::text, true);
  r := r || 'S27 Gesamt voll -> direkte Uploads gesperrt: ' || (not speicher_upload_erlaubt('chat-bilder', uAA || '/y.jpg'))::text || '; ';
  reset role;
  select count(*) into n from admin_protokoll where aktion = 'speicher_geaendert' and akteur_id = uA;
  r := r || 'S28 Protokoll=' || n || ' Eintraege, Beispiel: ' || (select details::text from admin_protokoll where aktion = 'speicher_geaendert' and akteur_id = uA
        and details ->> 'schluessel' = 'teamcloud_verein' order by erstellt_am, id limit 1) || '; ';
  set local role anon;
  r := r || 'S29 anon liest Kontingentwerte: ' || (select count(*) from speicher_kontingente_oeffentlich()) || '; ';
  begin perform * from speicher_kontingente; r := r || 'S30 FEHLER anon liest Tabelle; ';
  exception when others then r := r || 'S30 Tabelle fuer anon gesperrt; '; end;
  raise exception 'ERGEBNIS: %', r;
end $$;
