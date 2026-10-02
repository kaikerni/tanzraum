-- TanzRaum-Netzwerk, Buddys, Messenger, JuryRaum-Schalter (Rollback-Test).
-- Eine Transaktion, endet mit raise exception 'ERGEBNIS:...' -> alles wird zurueckgerollt (inkl. der fuer
-- erfundene Testpersonen ausgesetzten Fremdschluessel). auth.users bleibt unberuehrt.
do $$
declare
  uF1 uuid := gen_random_uuid(); uF2 uuid := gen_random_uuid(); uP uuid := gen_random_uuid();
  uB1 uuid := gen_random_uuid(); uB2 uuid := gen_random_uuid(); uK uuid := gen_random_uuid(); uT uuid := gen_random_uuid();
  uA uuid := gen_random_uuid();
  v uuid := gen_random_uuid();
  admin_r uuid := 'd8b4d77d-b91a-4b3d-9260-2c29ee7c09f9'; taenzerin uuid := '89c3ab8a-824e-4ee1-84da-d68344a45335';
  r text := ''; t text; n int; b boolean; g uuid; dm uuid; ts timestamptz; ts2 timestamptz; x uuid;
begin
  alter table vereins_mitglieder drop constraint vereins_mitglieder_user_id_fkey, drop constraint vereins_mitglieder_hinzugefuegt_von_fkey;
  alter table benachrichtigungen drop constraint benachrichtigungen_user_id_fkey;
  alter table gespraech_teilnehmer drop constraint gespraech_teilnehmer_user_id_fkey;
  alter table nachrichten drop constraint nachrichten_sender_id_fkey;
  alter table profiles drop constraint profiles_id_fkey;
  insert into profiles (id, vorname, nachname, geschlecht, geburtsdatum, tarif, tarif_aktiv_bis, konto_privat, online_sichtbar, zuletzt_online) values
    (uF1, 'Fiona', 'Frei', 'w', '1990-01-01', 'free', null, false, true, now()),
    (uF2, 'Felix', 'Frei', 'm', '1991-01-01', 'free', null, false, true, now()),
    (uP,  'Paula', 'Privat', 'w', '1992-01-01', 'basic', now() + interval '1 year', true, true, now()),
    (uB1, 'Bea', 'Basic', 'w', '1993-01-01', 'basic', now() + interval '1 year', false, true, now()),
    (uB2, 'Lisa', 'Basic', 'w', '1994-01-01', 'basic', now() + interval '1 year', false, true, now()),
    (uK,  'Kim', 'Kind', 'w', (current_date - interval '14 years')::date, 'free', null, false, true, now()),
    (uT,  'Tom', 'Trainer', 'm', '1980-01-01', 'free', null, false, true, now()),
    (uA,  'Ada', 'Admin', 'w', '1985-01-01', 'free', null, false, false, null);
  update profiles set ist_plattform_admin = true where id = uA;
  insert into vereine (id, name, tarif, tarif_aktiv_bis) values (v, 'Netzwerkverein Test', 'verein', now() + interval '1 year');
  insert into vereins_mitglieder (user_id, verein_id, rolle_id) values (uT, v, admin_r), (uK, v, taenzerin);

  set local role authenticated;

  -- ===================== TEST 1: FREE =====================
  perform set_config('request.jwt.claims', json_build_object('sub', uF1, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uF1::text, true);
  r := r || coalesce('F1 Tarif=' || mein_tarif(), 'NULL') || '; ';
  r := r || coalesce('F2 Direktnachricht an freies Profil=' || darf_direkt_schreiben(uF2), 'NULL') || '; ';
  select k.ergebnis, k.gespraech_id into t, dm from kontakt_aufnehmen(uF2) k;
  r := r || coalesce('F3 Chat starten=' || t, 'NULL') || '; ';
  insert into nachrichten (gespraech_id, sender_id, inhalt) values (dm, uF1, 'Hallo Felix');
  r := r || coalesce('F4 an privates Konto=' || darf_direkt_schreiben(uP) || '/' || coalesce(schreib_sperrgrund(uP), '-'), 'NULL') || '; ';
  r := r || coalesce('F5 an Kind (fremd)=' || darf_direkt_schreiben(uK) || '/' || coalesce(schreib_sperrgrund(uK), '-'), 'NULL') || '; ';
  select count(*) into n from nutzer_suchen('Kim'); r := r || coalesce('F6 Suche findet Kind=' || n, 'NULL') || '; ';
  select count(*) into n from nutzer_suchen('Felix'); r := r || coalesce('F7 Suche findet Felix=' || n, 'NULL') || '; ';
  begin perform kontaktanfrage_senden(uB1); r := r || 'F8 FEHLER Buddy-Anfrage als FREE; ';
  exception when others then r := r || 'F8 Buddy-Anfrage FREE gesperrt; '; end;
  begin perform gruppenchat_erstellen('Freie Gruppe', array[uF2]); r := r || 'F9 FEHLER Gruppenchat als FREE; ';
  exception when others then r := r || 'F9 Gruppenchat FREE gesperrt; '; end;
  r := r || coalesce('F10 Buddy-Knopf im Profil=' || (netzwerk_person(uB1)->>'kann_vernetzen'), 'NULL') || '; ';
  select count(*) into n from meine_buddys(); r := r || coalesce('F11 Buddyliste=' || n, 'NULL') || '; ';
  -- Spotlight erstellen: nur ab BASIC (unveraendert)
  reset role; update plattform_einstellungen set spotlights_aktiv = true where id; set local role authenticated;
  begin perform spotlight_erstellen(null, 'foto', 'x', null, null, 'netzwerk'); r := r || 'F12 FEHLER Spotlight als FREE; ';
  exception when others then r := r || coalesce('F12 Spotlight FREE: ' || sqlerrm, 'NULL') || '; '; end;

  -- Felix (FREE) empfaengt, sieht den Chat und antwortet
  perform set_config('request.jwt.claims', json_build_object('sub', uF2, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uF2::text, true);
  select count(*) into n from chat_nachrichten(dm); r := r || coalesce('F13 Felix liest=' || n, 'NULL') || '; ';
  insert into nachrichten (gespraech_id, sender_id, inhalt) values (dm, uF2, 'Hallo Fiona');
  r := r || 'F14 Felix antwortet ok; ';

  -- ===================== Zustellstatus =====================
  perform set_config('request.jwt.claims', json_build_object('sub', uF1, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uF1::text, true);
  select c.partner_zugestellt_bis, c.partner_gelesen_bis into ts, ts2 from chat_kopf(dm) c;
  r := r || coalesce('Z1 vor Zustellung zugestellt>=gelesen=' || (ts >= ts2)::text, 'NULL') || '; ';
  reset role;
  update gespraech_teilnehmer set zugestellt_bis = null, last_read_at = now() - interval '1 hour' where gespraech_id = dm and user_id = uF2;
  set local role authenticated;
  select c.partner_zugestellt_bis into ts from chat_kopf(dm) c; r := r || coalesce('Z2 zugestellt=' || coalesce(ts::text, 'leer'), 'NULL') || '; ';
  perform set_config('request.jwt.claims', json_build_object('sub', uF2, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uF2::text, true);
  perform nachrichten_zugestellt();
  perform set_config('request.jwt.claims', json_build_object('sub', uF1, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uF1::text, true);
  select c.partner_zugestellt_bis, c.partner_gelesen_bis into ts, ts2 from chat_kopf(dm) c;
  r := r || coalesce('Z3 nach App-Oeffnen zugestellt=' || (ts > now() - interval '1 minute')::text || ', gelesen alt=' || (ts2 < now() - interval '30 minutes')::text, 'NULL') || '; ';
  perform set_config('request.jwt.claims', json_build_object('sub', uF2, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uF2::text, true);
  perform chat_gelesen(dm);
  perform set_config('request.jwt.claims', json_build_object('sub', uF1, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uF1::text, true);
  select c.partner_gelesen_bis into ts2 from chat_kopf(dm) c; r := r || coalesce('Z4 gelesen=' || (ts2 > now() - interval '1 minute')::text, 'NULL') || '; ';

  -- ===================== TEST 2: BASIC =====================
  perform set_config('request.jwt.claims', json_build_object('sub', uB1, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uB1::text, true);
  r := r || coalesce('B1 Buddy-Anfrage=' || kontaktanfrage_senden(uB2), 'NULL') || '; ';
  perform set_config('request.jwt.claims', json_build_object('sub', uB2, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uB2::text, true);
  select count(*) into n from meine_kontaktanfragen() k where k.richtung = 'eingehend'; r := r || coalesce('B2 eingehende Anfragen=' || n, 'NULL') || '; ';
  perform kontaktanfrage_beantworten(uB1, 'annehmen');
  select string_agg(b2.anzeige || ':' || b2.online, ',') into t from meine_buddys() b2; r := r || coalesce('B3 Buddys Lisa=' || coalesce(t, '-'), 'NULL') || '; ';
  perform set_config('request.jwt.claims', json_build_object('sub', uB1, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uB1::text, true);
  r := r || coalesce('B4 an privates Konto ohne Buddy=' || darf_direkt_schreiben(uP) || '/' || coalesce(schreib_sperrgrund(uP), '-'), 'NULL') || '; ';
  perform kontaktanfrage_senden(uP);
  perform set_config('request.jwt.claims', json_build_object('sub', uP, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uP::text, true);
  perform kontaktanfrage_beantworten(uB1, 'annehmen');
  perform set_config('request.jwt.claims', json_build_object('sub', uB1, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uB1::text, true);
  r := r || coalesce('B5 an privates Konto als Buddy=' || darf_direkt_schreiben(uP), 'NULL') || '; ';
  select string_agg(k.anzeige, ',' order by k.anzeige) into t from gruppenchat_kandidaten() k;
  r := r || coalesce('B5b Kandidaten=' || t, 'NULL') || '; ';
  -- Gruppenchat
  begin perform gruppenchat_erstellen('Mit Kind', array[uB2, uK]); r := r || 'B6 FEHLER Kind im Gruppenchat; ';
  exception when others then r := r || 'B6 Kind nicht aufnehmbar; '; end;
  begin perform gruppenchat_erstellen('Mit FREE', array[uB2, uF2]); r := r || 'B7 FEHLER FREE im Gruppenchat; ';
  exception when others then r := r || 'B7 FREE nicht aufnehmbar; '; end;
  g := gruppenchat_erstellen('Garde-Freunde', array[uB2, uP]);
  -- Gruppenchats: Schreiben nur ueber die Schutzpruefung (direktes Einfuegen ist gesperrt)
  begin insert into nachrichten (gespraech_id, sender_id, inhalt) values (g, uB1, 'direkt'); r := r || 'B8a FEHLER direkt in Gruppenchat; ';
  exception when others then r := r || 'B8a direkt gesperrt; '; end;
  reset role; perform schutz_veroeffentlichen(uB1, g, 'neu', null, jsonb_build_object('inhalt', 'Hallo Gruppe')); set local role authenticated;
  select string_agg(c.bereich || '/' || c.untertitel, ',') into t from chat_liste() c where c.id = g; r := r || coalesce('B8 Gruppenchat=' || t, 'NULL') || '; ';
  select count(*) into n from gruppenchat_mitglieder(g); r := r || coalesce('B9 Mitglieder=' || n, 'NULL') || '; ';
  perform set_config('request.jwt.claims', json_build_object('sub', uB2, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uB2::text, true);
  reset role; perform schutz_veroeffentlichen(uB2, g, 'neu', null, jsonb_build_object('inhalt', 'Hallo zurück')); set local role authenticated;
  select count(*) into n from chat_nachrichten(g); r := r || coalesce('B10 Lisa liest Gruppe=' || n, 'NULL') || '; ';
  begin perform gruppenchat_mitglied_entfernen(g, uP); r := r || 'B11 FEHLER Nicht-Ersteller entfernt; ';
  exception when others then r := r || 'B11 nur Ersteller entfernt; '; end;
  perform set_config('request.jwt.claims', json_build_object('sub', uF2, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uF2::text, true);
  select count(*) into n from chat_nachrichten(g); r := r || coalesce('B12 Fremder liest Gruppe=' || n, 'NULL') || '; ';
  select count(*) into n from nachrichten where gespraech_id = g; r := r || coalesce('B13 Fremder RLS=' || n, 'NULL') || '; ';
  begin insert into nachrichten (gespraech_id, sender_id, inhalt) values (g, uF2, 'rein');  r := r || 'B14 FEHLER Fremder schreibt; ';
  exception when others then r := r || 'B14 Fremder schreibt nicht; '; end;
  -- Lesestatus in der Gruppe: erst wenn alle gelesen haben
  perform set_config('request.jwt.claims', json_build_object('sub', uB1, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uB1::text, true);
  select c.partner_gelesen_bis into ts from chat_kopf(g) c;
  r := r || coalesce('B15 Gruppe gelesen (Paula noch nicht)=' || (ts > (select max(gesendet_am) from nachrichten where gespraech_id = g and sender_id = uB1))::text, 'NULL') || '; ';
  perform buddy_entfernen(uB2);
  select count(*) into n from meine_buddys(); r := r || coalesce('B16 nach Entfernen von Lisa Buddys (nur Paula)=' || n, 'NULL') || '; ';
  perform gruppenchat_verlassen(g);
  select count(*) into n from chat_liste() c where c.id = g; r := r || coalesce('B17 nach Verlassen sichtbar=' || n, 'NULL') || '; ';
  reset role;
  select (erstellt_von = uB2 or erstellt_von = uP)::text into t from gespraeche where id = g;
  set local role authenticated; r := r || coalesce('B18 Leitung uebergeben=' || t, 'NULL') || '; ';

  -- ===================== TEST 4: JUGENDSCHUTZ =====================
  perform set_config('request.jwt.claims', json_build_object('sub', uK, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uK::text, true);
  r := r || coalesce('J1 Kind an Trainer (Verein)=' || darf_direkt_schreiben(uT), 'NULL') || '; ';
  r := r || coalesce('J2 Kind an Fremde=' || darf_direkt_schreiben(uB1) || '/' || coalesce(schreib_sperrgrund(uB1), '-'), 'NULL') || '; ';
  begin perform kontaktanfrage_senden(uB1); r := r || 'J3 FEHLER Kind Buddy-Anfrage; ';
  exception when others then r := r || 'J3 Kind Buddy-Anfrage gesperrt; '; end;
  begin perform gruppenchat_erstellen('Kind', array[uT]); r := r || 'J4 FEHLER Kind Gruppenchat; ';
  exception when others then r := r || 'J4 Kind Gruppenchat gesperrt; '; end;
  perform set_config('request.jwt.claims', json_build_object('sub', uB1, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uB1::text, true);
  begin perform chat_dm_starten(uK); r := r || 'J5 FEHLER Fremde an Kind; ';
  exception when others then r := r || 'J5 Fremde an Kind gesperrt; '; end;
  r := r || coalesce('J6 Profil Kind fuer Fremde=' || coalesce(netzwerk_person(uK)->>'darf_schreiben', 'null'), 'NULL') || '; ';

  -- ===================== Spam-Schutz =====================
  perform set_config('request.jwt.claims', json_build_object('sub', uF2, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uF2::text, true);
  reset role;
  for n in 1..20 loop
    x := gen_random_uuid();
    insert into profiles (id, vorname, nachname, geschlecht, geburtsdatum) values (x, 'Massen' || n, 'Test', 'm', '1990-01-01');
    insert into gespraeche (typ, dm_schluessel, erstellt_von) values ('dm', least(uF2, x)::text || ':' || greatest(uF2, x)::text, uF2);
  end loop;
  x := gen_random_uuid();
  insert into profiles (id, vorname, nachname, geschlecht, geburtsdatum) values (x, 'Massen21', 'Test', 'm', '1990-01-01');
  set local role authenticated;
  begin perform chat_dm_starten(x); r := r || 'S1 FEHLER 21. Chat; ';
  exception when others then r := r || coalesce('S1 21. neuer Chat: ' || sqlerrm, 'NULL') || '; '; end;
  r := r || coalesce('S2 bestehender Chat weiter=' || (chat_dm_starten(uF1) = dm)::text, 'NULL') || '; ';

  -- ===================== JuryRaum-Schalter =====================
  reset role;
  insert into juryraum_mitglieder (user_id, rolle, aktiv) values (uT, 'admin', true);
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', uT, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uT::text, true);
  r := r || coalesce('JR1 Standard aus: fuer mich=' || juryraum_fuer_mich() || ', Rolle=' || coalesce(juryraum_eigene_rolle(), 'keine'), 'NULL') || '; ';
  begin perform admin_juryraum_setzen(true); r := r || 'JR2 FEHLER Nicht-Admin schaltet; ';
  exception when others then r := r || 'JR2 nur Plattform-Admin; '; end;
  perform set_config('request.jwt.claims', json_build_object('sub', uA, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uA::text, true);
  perform admin_juryraum_setzen(true);
  perform set_config('request.jwt.claims', json_build_object('sub', uT, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uT::text, true);
  r := r || coalesce('JR3 an: fuer mich=' || juryraum_fuer_mich() || ', Rolle=' || coalesce(juryraum_eigene_rolle(), 'keine'), 'NULL') || '; ';
  reset role;
  select count(*) into n from juryraum_mitglieder where user_id = uT; r := r || coalesce('JR4 Daten erhalten=' || n, 'NULL') || '; ';

  raise exception 'ERGEBNIS:%', r;
end $$;
