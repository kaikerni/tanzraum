-- Kostenlose Sonderfreischaltung per Einladung, Vereinswechsel mit Zustimmung, administrativer Wechsel, Import-Hinweise
-- (Rollback-Test). Eine Transaktion, endet mit raise exception 'ERGEBNIS:...' -> alles wird zurueckgerollt.
-- Testkonten entstehen nur in dieser Transaktion (lokale Testdatenbank).
do $$
declare
  uA uuid := gen_random_uuid();   -- TanzRaum-Admin
  uN uuid := gen_random_uuid();   -- neuer Nutzer (BASIC-Einladung)
  uV uuid := gen_random_uuid();   -- Nutzer (VEREIN-Einladung, befristet)
  uX uuid := gen_random_uuid();   -- fremder Nutzer (andere E-Mail)
  uU uuid := gen_random_uuid();   -- unbestaetigte E-Mail
  uAA uuid := gen_random_uuid();  -- Vereinsadmin A
  uBA uuid := gen_random_uuid();  -- Vereinsadmin B
  uM uuid := gen_random_uuid();   -- Max: Mitglied in A
  uO uuid := gen_random_uuid();   -- Olga: ohne Verein
  uP uuid := gen_random_uuid();   -- Paul: Mitglied in A (lehnt ab)
  vA uuid := gen_random_uuid();
  vB uuid := gen_random_uuid();
  admin_r uuid := (select id from rollen where name = 'Vereins-Admin');
  taenzer_r uuid := (select id from rollen where name = 'Tänzer');
  r text := ''; t text; n int; b boolean; j jsonb; e1 uuid; e2 uuid; e3 uuid; tok uuid; w uuid; w2 uuid; gA uuid; trA uuid;
begin
  insert into auth.users (id, email, email_confirmed_at) values
    (uA, 'admin@tanzraum.test', now()), (uN, 'neu@beispiel.test', now()), (uV, 'verein@beispiel.test', now()),
    (uX, 'fremd@beispiel.test', now()), (uU, 'offen@beispiel.test', null), (uAA, 'a-admin@beispiel.test', now()),
    (uBA, 'b-admin@beispiel.test', now()), (uM, 'max@beispiel.test', now()), (uO, 'olga@beispiel.test', now()),
    (uP, 'paul@beispiel.test', now());
  insert into profiles (id, vorname, nachname, handle, geschlecht, geburtsdatum, tarif, avatar_url) values
    (uA, 'Ada', 'Admin', 'ada_t', 'w', '1985-01-01', 'free', null),
    (uN, 'Nina', 'Neu', 'nina_t', 'w', '1990-01-01', 'free', null),
    (uV, 'Vito', 'Verein', 'vito_t', 'm', '1990-01-01', 'free', null),
    (uX, 'Xaver', 'Fremd', 'xaver_t', 'm', '1990-01-01', 'free', null),
    (uU, 'Uwe', 'Offen', 'uwe_t', 'm', '1990-01-01', 'free', null),
    (uAA, 'Anna', 'A-Admin', 'anna_t', 'w', '1980-01-01', 'free', null),
    (uBA, 'Bernd', 'B-Admin', 'bernd_t', 'm', '1980-01-01', 'free', null),
    (uM, 'Max', 'Mustermann', 'max_t', 'm', '2000-01-01', 'free', 'avatare/max.jpg'),
    (uO, 'Olga', 'Ohne', 'olga_t', 'w', '2000-01-01', 'free', null),
    (uP, 'Paul', 'Bleibt', 'paul_t', 'm', '2000-01-01', 'free', null)
  on conflict (id) do update set vorname = excluded.vorname, nachname = excluded.nachname, handle = excluded.handle,
    geschlecht = excluded.geschlecht, geburtsdatum = excluded.geburtsdatum, tarif = excluded.tarif, avatar_url = excluded.avatar_url;
  update profiles set ist_plattform_admin = true where id = uA;
  insert into vereine (id, name, tarif, tarif_aktiv_bis) values (vA, 'Verein A Test', 'verein', null), (vB, 'Verein B Test', 'verein', null);
  insert into vereins_mitglieder (user_id, verein_id, rolle_id, aufnahme_status) values
    (uAA, vA, admin_r, 'aufgenommen'), (uBA, vB, admin_r, 'aufgenommen'), (uM, vA, taenzer_r, 'aufgenommen'), (uP, vA, taenzer_r, 'aufgenommen');
  -- Vereinsdaten von A (Gruppe + Training) fuer den Sichtbarkeitstest
  insert into gruppen (id, verein_id, name) values (gen_random_uuid(), vA, 'Garde A') returning id into gA;
  insert into spotlights (user_id, media_typ, media_path, ablauf_am) values (uM, 'foto', uM || '/sp.jpg', now() + interval '1 day');
  grant execute on function public.tarif_von(uuid) to authenticated; -- nur fuer die Auswertung (zurueckgerollt)

  set local role authenticated;

  -- ===================== Teil 1: kostenlose Sonderfreischaltung =====================
  perform set_config('request.jwt.claims', json_build_object('sub', uAA, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uAA::text, true);
  begin perform admin_freischaltung_einladen('neu@beispiel.test', 'basic', null, null); r := r || 'F1 FEHLER Vereinsadmin laedt ein; ';
  exception when others then r := r || 'F1 Vereinsadmin kann keine Sonderfreischaltung vergeben; '; end;
  begin perform admin_freischalten(uX, 'verein', 'kostenlos', null, null); r := r || 'F2 FEHLER Vereinsadmin vergibt VEREIN; ';
  exception when others then r := r || 'F2 Vereinsadmin kann keine (fremde) Vereinslizenz vergeben; '; end;
  begin perform * from admin_freischaltung_einladungen(); r := r || 'F3 FEHLER Vereinsadmin sieht Einladungen; ';
  exception when others then r := r || 'F3 Uebersicht nur Admin; '; end;
  begin insert into freischaltung_einladungen (email, tarif) values ('x@y.de', 'basic'); r := r || 'F4 FEHLER direkter Insert; ';
  exception when others then r := r || 'F4 Tabelle direkt gesperrt; '; end;

  perform set_config('request.jwt.claims', json_build_object('sub', uA, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uA::text, true);
  e1 := (admin_freischaltung_einladen('Neu@Beispiel.test', 'basic', null, 'Tester') ->> 'id')::uuid;
  e2 := (admin_freischaltung_einladen('verein@beispiel.test', 'verein', current_date + 30, 'Influencer Kooperation') ->> 'id')::uuid;
  e3 := (admin_freischaltung_einladen('offen@beispiel.test', 'basic', current_date + 10, null) ->> 'id')::uuid;
  begin perform admin_freischaltung_einladen('neu@beispiel.test', 'verein', null, null); r := r || 'F5 FEHLER doppelte offene Einladung; ';
  exception when others then r := r || 'F5 keine doppelte offene Einladung; '; end;
  select count(*) into n from admin_freischaltung_einladungen() x where x.status = 'ausstehend';
  r := r || 'F6 ausstehend=' || n || '; ';
  reset role;
  r := r || 'F7 vor Annahme kein Tarif: ' || tarif_von(uN) || '/' || tarif_von(uV) || ', Abos=' || (select count(*) from abos where user_id in (uN, uV)) || '; ';
  select token into tok from freischaltung_einladungen where id = e1;
  set local role anon;
  select x.tarif || ',' || x.email_maskiert || ',' || x.gueltig into t from freischaltung_einladung_vorschau(tok) x;
  r := r || 'F8 Vorschau ohne Anmeldung=' || t || '; ';
  begin perform freischaltung_einladung_annehmen(tok); r := r || 'F9 FEHLER anonym angenommen; ';
  exception when others then r := r || 'F9 anonym nicht annehmbar; '; end;
  reset role;
  r := r || 'F10 Aufruf des Links aktiviert nichts: ' || tarif_von(uN) || '; ';
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', uX, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uX::text, true);
  begin perform freischaltung_einladung_annehmen(tok); r := r || 'F11 FEHLER fremdes Konto uebernimmt; ';
  exception when others then r := r || 'F11 fremdes Konto kann nicht uebernehmen; '; end;
  perform set_config('request.jwt.claims', json_build_object('sub', uN, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uN::text, true);
  j := freischaltung_einladung_annehmen(tok);
  r := r || 'F12 BASIC unbefristet angenommen: tarif=' || (j ->> 'tarif') || '; ';
  begin perform freischaltung_einladung_annehmen(tok); r := r || 'F13 FEHLER zweimal; ';
  exception when others then r := r || 'F13 nur einmal verwendbar; '; end;
  -- VEREIN befristet
  reset role;
  select token into tok from freischaltung_einladungen where id = e2;
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', uV, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uV::text, true);
  j := freischaltung_einladung_annehmen(tok);
  reset role;
  r := r || 'F14 VEREIN befristet: tarif=' || tarif_von(uV) || ' bis=' || coalesce((select tarif_aktiv_bis::date::text from profiles where id = uV), '-')
    || ' Vereine=' || (select count(*) from vereins_mitglieder where user_id = uV) || ' Vereinsabos=' || (select count(*) from abos where inhaber = 'verein' and erteilt_von = uA) || '; ';
  r := r || 'F15 BASIC unbefristet: ' || tarif_von(uN) || ' bis=' || coalesce((select tarif_aktiv_bis::text from profiles where id = uN), 'unbegrenzt')
    || ' Lizenzart=' || (select abo_lizenzart(a) from abos a where a.user_id = uN) || '; ';
  -- unbestaetigte E-Mail
  select token into tok from freischaltung_einladungen where id = e3;
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', uU, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uU::text, true);
  begin perform freischaltung_einladung_annehmen(tok); r := r || 'F16 FEHLER ohne bestaetigte E-Mail; ';
  exception when others then r := r || 'F16 nur mit bestaetigter E-Mail; '; end;
  reset role;
  -- Ablauf der befristeten Freischaltung: Konto bleibt, Tarif faellt zurueck, keine Abbuchung
  update abos set laeuft_bis = now() - interval '1 minute' where user_id = uV;
  perform abos_ablaufen();
  r := r || 'F17 nach Ablauf: tarif=' || tarif_von(uV) || ' Konto=' || exists (select 1 from profiles where id = uV)
    || ' Status=' || (select status from abos where user_id = uV) || '; ';
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', uA, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uA::text, true);
  select string_agg(x.email || ':' || x.status || ':' || coalesce(x.nutzer, '-'), ', ' order by x.email) into t from admin_freischaltung_einladungen() x;
  r := r || 'F18 Uebersicht=' || t || '; ';
  perform admin_freischaltung_einladung_widerrufen(e1);
  reset role;
  r := r || 'F19 widerrufen: tarif=' || tarif_von(uN) || ' Protokoll=' || (select count(*) from admin_protokoll where aktion like 'freischaltung_%') || '; ';
  set local role authenticated;

  -- ===================== Teil 2/3: Vereinswechsel mit Zustimmung =====================
  -- Olga (ohne Verein) -> B: direkt (bestehende Logik)
  perform set_config('request.jwt.claims', json_build_object('sub', uBA, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uBA::text, true);
  j := verein_person_hinzufuegen(vB, 'olga@beispiel.test', null, null);
  r := r || 'W1 ohne Verein -> B: ' || (j ->> 'status') || '; ';
  -- Max (A) -> B: nur Anfrage an die Person
  j := verein_person_hinzufuegen(vB, 'max@beispiel.test', null, null);
  r := r || 'W2 Max in A -> ' || (j ->> 'status') || '; ';
  select x.stand into t from freigabe_anfragen(vB) x where x.person like 'Max%';
  r := r || 'W3 B sieht Stand=' || t || ' ohne Verein A=' || ((select x.anderer_verein from freigabe_anfragen(vB) x where x.person like 'Max%') is null) || '; ';
  select id into w from vereinswechsel_anfragen where mitglied_user_id = uM and status = 'offen';
  perform set_config('request.jwt.claims', json_build_object('sub', uAA, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uAA::text, true);
  select count(*) into n from freigabe_anfragen(vA);
  r := r || 'W4 A sieht vor Zustimmung=' || n || '; ';
  begin perform freigabe_entscheiden(w, true); r := r || 'W5 FEHLER A gibt ohne Zustimmung frei; ';
  exception when others then r := r || 'W5 kein Wechsel ohne Zustimmung; '; end;
  -- Admin darf ohne Zustimmung nicht verschieben
  perform set_config('request.jwt.claims', json_build_object('sub', uA, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uA::text, true);
  begin perform admin_vereinswechsel_durchfuehren(w, 'Test ohne Zustimmung'); r := r || 'W6 FEHLER Admin verschiebt ohne Wunsch; ';
  exception when others then r := r || 'W6 Admin kann ohne Wechselwunsch nicht verschieben; '; end;
  -- Paul (A) -> B: lehnt ab
  perform set_config('request.jwt.claims', json_build_object('sub', uBA, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uBA::text, true);
  perform verein_person_hinzufuegen(vB, 'paul_t', null, null);
  select id into w2 from vereinswechsel_anfragen where mitglied_user_id = uP and status = 'offen';
  perform set_config('request.jwt.claims', json_build_object('sub', uP, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uP::text, true);
  r := r || 'W7 Paul sieht Anfrage=' || (select count(*) from meine_vereinswechsel()) || '; ';
  j := vereinswechsel_bestaetigen(w2, false);
  reset role;
  r := r || 'W8 Paul lehnt ab -> ' || (j ->> 'status') || ', Verein=' || (select v.name from vereins_mitglieder vm join vereine v on v.id = vm.verein_id where vm.user_id = uP) || '; ';
  set local role authenticated;
  -- fremde Person kann Max' Anfrage nicht bestaetigen
  perform set_config('request.jwt.claims', json_build_object('sub', uBA, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uBA::text, true);
  begin perform vereinswechsel_bestaetigen(w, true); r := r || 'W9 FEHLER Vereinsadmin bestaetigt fuer Person; ';
  exception when others then r := r || 'W9 nur die Person selbst stimmt zu; '; end;
  -- Max stimmt zu
  perform set_config('request.jwt.claims', json_build_object('sub', uM, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uM::text, true);
  j := vereinswechsel_bestaetigen(w, true);
  r := r || 'W10 Max stimmt zu -> ' || (j ->> 'status') || '; ';
  -- A blockiert
  perform set_config('request.jwt.claims', json_build_object('sub', uAA, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uAA::text, true);
  r := r || 'W11 A sieht nach Zustimmung=' || (select count(*) from freigabe_anfragen(vA)) || '; ';
  j := freigabe_entscheiden(w, false);
  r := r || 'W12 A blockiert -> ' || (j ->> 'status') || '; ';
  -- Vereinsadmins koennen den administrativen Wechsel nicht ausfuehren
  begin perform admin_vereinswechsel_durchfuehren(w, 'Vereinsadmin A versucht es'); r := r || 'W13 FEHLER Vereinsadmin A; ';
  exception when others then r := r || 'W13 Vereinsadmin A gesperrt; '; end;
  perform set_config('request.jwt.claims', json_build_object('sub', uBA, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uBA::text, true);
  begin perform admin_vereinswechsel_durchfuehren(w, 'Vereinsadmin B versucht es'); r := r || 'W14 FEHLER Vereinsadmin B; ';
  exception when others then r := r || 'W14 Vereinsadmin B gesperrt; '; end;
  begin perform * from admin_vereinswechsel_liste(); r := r || 'W15 FEHLER Liste fuer Vereinsadmin; ';
  exception when others then r := r || 'W15 Liste nur Admin; '; end;
  -- TanzRaum-Admin fuehrt durch
  perform set_config('request.jwt.claims', json_build_object('sub', uA, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uA::text, true);
  r := r || 'W16 Admin-Liste=' || (select count(*) from admin_vereinswechsel_liste() x where x.user_id = uM and x.stand = 'abgelehnt') || '; ';
  begin perform admin_vereinswechsel_durchfuehren(w, ''); r := r || 'W17 FEHLER ohne Grund; ';
  exception when others then r := r || 'W17 Grund Pflicht; '; end;
  j := admin_vereinswechsel_durchfuehren(w, 'Verein A gibt nicht frei, Person moechte wechseln (Mail vom 01.10.)');
  reset role;
  r := r || 'W18 administrativ: A=' || exists (select 1 from vereins_mitglieder where user_id = uM and verein_id = vA)
    || ' B=' || exists (select 1 from vereins_mitglieder where user_id = uM and verein_id = vB)
    || ' Rolle=' || (select r2.name from vereins_mitglieder vm join rollen r2 on r2.id = vm.rolle_id where vm.user_id = uM)
    || ' Konten=' || (select count(*) from profiles where handle = 'max_t')
    || ' Profilbild=' || (select avatar_url from profiles where id = uM)
    || ' Spotlights=' || (select count(*) from spotlights where user_id = uM) || '; ';
  select details into j from admin_protokoll where aktion = 'vereinswechsel_administrativ' and ziel_user_id = uM;
  r := r || 'W19 Protokoll: von=' || (j ->> 'bisheriger_verein') || ' nach=' || (j ->> 'neuer_verein') || ' art=' || (j ->> 'art')
    || ' Grund=' || ((j ->> 'grund') is not null) || ' Zustimmung=' || ((j ->> 'zustimmung_person_am') is not null)
    || ' Akteur=' || (select akteur_name from admin_protokoll where aktion = 'vereinswechsel_administrativ' and ziel_user_id = uM) || '; ';
  r := r || 'W20 Anfrage=' || (select status || '/' || art from vereinswechsel_anfragen where id = w) || '; ';
  -- Vereinsdaten: B sieht die Gruppe von A nicht, A sieht Max nicht mehr als Mitglied
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', uBA, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uBA::text, true);
  r := r || 'W21 B sieht Gruppen von A=' || (select count(*) from gruppen where verein_id = vA) || '; ';
  perform set_config('request.jwt.claims', json_build_object('sub', uAA, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uAA::text, true);
  r := r || 'W22 A sieht Mitglieder von B=' || (select count(*) from vereins_mitglieder where verein_id = vB) || '; ';
  -- Max' Sicht: neuer Verein
  perform set_config('request.jwt.claims', json_build_object('sub', uM, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uM::text, true);
  r := r || 'W23 Max sieht offene Wechsel=' || (select count(*) from meine_vereinswechsel() x where not x.bisheriger_verein_abgelehnt) || '; ';

  -- normaler Wechsel mit Freigabe: Paul stimmt einer neuen Anfrage zu, A gibt frei
  perform set_config('request.jwt.claims', json_build_object('sub', uBA, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uBA::text, true);
  perform verein_person_hinzufuegen(vB, 'paul@beispiel.test', null, null);
  select id into w2 from vereinswechsel_anfragen where mitglied_user_id = uP and status = 'offen';
  perform set_config('request.jwt.claims', json_build_object('sub', uP, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uP::text, true);
  perform vereinswechsel_bestaetigen(w2, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uAA, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uAA::text, true);
  j := freigabe_entscheiden(w2, true);
  reset role;
  r := r || 'W24 normaler Wechsel: ' || (j ->> 'status') || ' A=' || exists (select 1 from vereins_mitglieder where user_id = uP and verein_id = vA)
    || ' B=' || exists (select 1 from vereins_mitglieder where user_id = uP and verein_id = vB) || ' art=' || (select art from vereinswechsel_anfragen where id = w2) || '; ';
  -- Tariflogik: Vereinslizenz von B deckt ab, keine kostenpflichtige BASIC entsteht
  r := r || 'W25 Tarif Max=' || tarif_von(uM) || ' Abos=' || (select count(*) from abos where user_id = uM) || '; ';
  -- direkte Tabellenaenderung durch Vereinsadmin unmoeglich
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', uBA, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uBA::text, true);
  begin update vereinswechsel_anfragen set mitglied_bestaetigt_at = now() where id = w; get diagnostics n = row_count;
    r := r || 'W26 direkte Zustimmung gesetzt=' || n || '; ';
  exception when others then r := r || 'W26 direkte Aenderung gesperrt; '; end;

  -- Einladungslink von B fuer eine Person in A: mit Zustimmung auf der Einladungsseite bzw. ohne (Bestaetigung im Dashboard)
  reset role;
  insert into vereins_mitglieder (user_id, verein_id, rolle_id, aufnahme_status) values (uX, vA, taenzer_r, 'aufgenommen'), (uU, vA, taenzer_r, 'aufgenommen');
  insert into einladungen (verein_id, rolle_id, created_by, expires_at, max_uses) values (vB, taenzer_r, uBA, now() + interval '7 days', 5) returning token into tok;
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', uX, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uX::text, true);
  r := r || 'W27 Einladungsseite Wechsel noetig=' || einladung_wechsel_noetig(tok) || '; ';
  j := invite_einloesen(tok, true);
  reset role;
  r := r || 'W28 Einladung mit Zustimmung: zugestimmt=' || ((select mitglied_bestaetigt_at from vereinswechsel_anfragen where mitglied_user_id = uX and status = 'offen') is not null)
    || ' noch in A=' || exists (select 1 from vereins_mitglieder where user_id = uX and verein_id = vA) || '; ';
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', uU, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uU::text, true);
  j := invite_einloesen(tok);
  reset role;
  r := r || 'W29 Einladung ohne Zustimmung: zugestimmt=' || ((select mitglied_bestaetigt_at from vereinswechsel_anfragen where mitglied_user_id = uU and status = 'offen') is not null)
    || ' Benachrichtigung=' || (select count(*) from benachrichtigungen where user_id = uU and typ = 'vereinswechsel') || '; ';
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', uBA, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uBA::text, true);

  -- ===================== Teil 4: Import-Hinweise =====================
  select string_agg(x.email || ':' || x.art, ', ' order by x.email) into t
  from mitglieder_import_konto_hinweise(vB, array['MAX@beispiel.test', 'olga@beispiel.test', 'neu@beispiel.test', 'nicht@da.test', 'A-Admin@beispiel.test']) x;
  r := r || 'I1 Hinweise B=' || t || '; ';
  perform set_config('request.jwt.claims', json_build_object('sub', uM, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uM::text, true);
  begin perform * from mitglieder_import_konto_hinweise(vB, array['x@y.de']); r := r || 'I2 FEHLER Mitglied fragt Konten ab; ';
  exception when others then r := r || 'I2 nur Vereinsadmin; '; end;

  raise exception 'ERGEBNIS:%', r;
end $$;
