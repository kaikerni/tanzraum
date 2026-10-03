-- Vereinsgruendung nur mit bestaetigter Vereinslizenz + Verein loeschen (Rollback-Test).
-- Eine Transaktion, endet mit raise exception 'ERGEBNIS:...'. Testkonten entstehen nur in dieser Transaktion.
create function pg_temp.als(u uuid) returns void language plpgsql as $f$
begin
  perform set_config('request.jwt.claims', case when u is null then '' else json_build_object('sub', u, 'role', 'authenticated')::text end, true);
  perform set_config('request.jwt.claim.sub', coalesce(u::text, ''), true);
end $f$;

do $$
declare
  uA uuid := gen_random_uuid();   -- TanzRaum-Admin
  uF uuid := gen_random_uuid();   -- FREE
  uB uuid := gen_random_uuid();   -- BASIC (Ueberweisung)
  uX uuid := gen_random_uuid();   -- FREE, fremd
  uM uuid := gen_random_uuid();   -- Mitglied in Bestandsverein
  uK uuid := gen_random_uuid();   -- FREE, kauft BASIC
  vAlt uuid := gen_random_uuid(); -- Bestandsverein ohne Lizenz (wie in Produktion)
  admin_r uuid := (select id from rollen where name = 'Vereins-Admin');
  taenzer_r uuid := (select id from rollen where name = 'Tänzerin');
  r text := ''; n int; n0 int; b boolean; j jsonb; v_abo uuid; v_z uuid; v_verein uuid; v_rechnung uuid; v_txt text;
begin
  insert into auth.users (id, email, email_confirmed_at) values
    (uA, 'admin@tanzraum.test', now()), (uF, 'free@beispiel.test', now()), (uB, 'basic@beispiel.test', now()),
    (uX, 'x@beispiel.test', now()), (uM, 'm@beispiel.test', now()), (uK, 'k@beispiel.test', now());
  insert into profiles (id, vorname, nachname, handle, geschlecht, geburtsdatum, tarif) values
    (uA, 'Ada', 'Admin', 'ada_vg', 'w', '1985-01-01', 'free'), (uF, 'Fritz', 'Free', 'fritz_vg', 'm', '1990-01-01', 'free'),
    (uB, 'Bea', 'Basic', 'bea_vg', 'w', '1990-01-01', 'basic'), (uX, 'Xaver', 'X', 'xaver_vg', 'm', '1990-01-01', 'free'),
    (uM, 'Mia', 'Mitglied', 'mia_vg', 'w', '1990-01-01', 'free'), (uK, 'Kim', 'Kauf', 'kim_vg', 'w', '1990-01-01', 'free')
  on conflict (id) do update set vorname = excluded.vorname, nachname = excluded.nachname, handle = excluded.handle, tarif = excluded.tarif;
  update profiles set ist_plattform_admin = true where id = uA;
  update plattform_anbieter set iban = coalesce(iban, 'DE02120300000000202051'), bank_inhaber = coalesce(bank_inhaber, 'TanzRaum Test') where id = true;
  -- BASIC-Nutzerin mit echtem BASIC-Abo
  insert into abos (inhaber, user_id, tarif, periode, preis_cent, anbieter, status) values ('person', uB, 'basic', 'jahr', 2990, 'stripe', 'active');
  -- Bestandsverein ohne Lizenz (Admin uM), so wie die drei Vereine in Produktion
  insert into vereine (id, name) values (vAlt, 'Bestandsverein ohne Lizenz');
  insert into vereins_mitglieder (user_id, verein_id, rolle_id) values (uM, vAlt, admin_r);
  select count(*) into n0 from vereine;
  -- wie in Produktion: angemeldete Rollen duerfen Zahlungsaufforderungen lesen, die Regel (RLS) entscheidet
  grant select on zahlungsaufforderungen to authenticated;
  insert into rechnungs_einstellungen (id) values (true) on conflict do nothing;

  set local role authenticated;

  -- ===== 1/2/8: FREE und BASIC koennen keinen Verein anlegen – auch nicht direkt =====
  perform pg_temp.als(uF);
  begin perform verein_anlegen('Free Verein', null); r := r || 'G1 FEHLER FREE legt Verein an; ';
  exception when others then
    get stacked diagnostics v_txt = pg_exception_hint;
    r := r || 'G1 FREE abgewiesen (' || v_txt || '); ';
  end;
  perform pg_temp.als(uB);
  begin perform verein_anlegen('Basic Verein', 'BV'); r := r || 'G2 FEHLER BASIC legt Verein an; ';
  exception when others then r := r || 'G2 BASIC abgewiesen; '; end;
  begin insert into vereine (name) values ('Direkt eingefuegt'); r := r || 'G8a FEHLER direktes Einfuegen; ';
  exception when others then r := r || 'G8a direktes Einfuegen in vereine gesperrt; '; end;
  begin insert into abos (inhaber, user_id, tarif, periode, preis_cent, anbieter, status) values ('verein', uB, 'verein', 'jahr', 0, 'manuell', 'active');
    r := r || 'G8b FEHLER Lizenz direkt; ';
  exception when others then r := r || 'G8b Lizenz direkt anlegen gesperrt; '; end;
  begin perform vereinsgruendung_abschliessen(gen_random_uuid()); r := r || 'G8c FEHLER Abschliessen aufrufbar; ';
  exception when others then r := r || 'G8c Abschliessen nur intern; '; end;
  begin perform abo_aktualisieren(gen_random_uuid(), 'active', null, null, null, null, 'x'); r := r || 'G8d FEHLER Aktivieren aufrufbar; ';
  exception when others then r := r || 'G8d Aktivieren nicht fuer Nutzer; '; end;
  begin perform admin_verein_anlegen('Admin-Weg', null); r := r || 'G8e FEHLER admin_verein_anlegen; ';
  exception when others then r := r || 'G8e admin_verein_anlegen nur TanzRaum-Admin; '; end;
  -- ohne Bestellung kein Kauf ohne Verein
  perform pg_temp.als(uF);
  begin perform abo_anlegen('verein', 'jahr', 'stripe', null); r := r || 'G8f FEHLER Kauf ohne Bestellung; ';
  exception when others then r := r || 'G8f Kauf erst nach Vereinsnamen; '; end;

  -- ===== 3: FREE bestellt (Stripe) – noch kein Verein =====
  perform vereinsgruendung_vorbereiten('TSC Gruendung', 'TSG');
  v_abo := abo_anlegen('verein', 'jahr', 'stripe', null);
  reset role;
  select count(*) into n from vereine;
  select exists (select 1 from vereins_mitglieder where user_id = uF) into b;
  r := r || format('G3 Bestellung: Abo %s, Vereine %s->%s, Vereinsadmin %s; ', (select status from abos where id = v_abo), n0, n, b);
  -- Zahlung laeuft (Lastschrift eingereicht, Anbieter meldet past_due/pending) -> weiterhin kein Verein
  perform pg_temp.als(null);
  perform abo_aktualisieren(v_abo, 'pending', null, null, 'sub_test_1', 'cus_1', 'checkout');
  perform abo_aktualisieren(v_abo, 'past_due', null, null, null, null, 'lastschrift_offen');
  select count(*) into n from vereine;
  r := r || format('G3b Zahlung laeuft: Abo %s, Vereine %s; ', (select status from abos where id = v_abo), n);
  -- Nachtlauf nach 2+ Tagen loescht die laufende Lastschrift nicht mehr
  update abos set erstellt_am = now() - interval '5 days' where id = v_abo;
  perform abos_ablaufen();
  r := r || format('G3c Nachtlauf: Abo noch da=%s; ', exists (select 1 from abos where id = v_abo));
  set local role authenticated;
  perform pg_temp.als(uF);
  begin perform vereinsgruendung_abbrechen(); r := r || 'G3d FEHLER Abbruch trotz laufender Zahlung; ';
  exception when others then r := r || 'G3d laufende Zahlung nicht abbrechbar; '; end;
  j := vereinsgruendung_status();
  r := r || format('G3e Status: Bestellung %s, Zahlung laeuft %s; ', j #>> '{bestellung,name}', j #>> '{bestellung,zahlung,laeuft}');

  -- ===== 4: Zahlung bestaetigt (Webhook, Service) -> Verein + Lizenz + Vereinsadmin =====
  reset role;
  perform pg_temp.als(null);
  perform abo_aktualisieren(v_abo, 'active', now() + interval '1 year', null, 'sub_test_1', 'cus_1', 'zahlung');
  select verein_id into v_verein from abos where id = v_abo;
  r := r || format('G4 bestaetigt: Verein %s, Name=%s, Lizenz=%s, Vereinsadmin=%s, Bestellung=%s, Hinweis an Person=%s; ',
    v_verein is not null, (select name from vereine where id = v_verein), verein_hat_lizenz(v_verein),
    exists (select 1 from vereins_mitglieder vm join rollen ro on ro.id = vm.rolle_id where vm.user_id = uF and vm.verein_id = v_verein and rollen_typ(ro.name) = 'admin'),
    (select status from vereinsgruendungen where abo_id = v_abo),
    exists (select 1 from benachrichtigungen where user_id = uF and link = '/dashboard/verein'));
  -- zweite Bestaetigung (Webhook doppelt) legt keinen zweiten Verein an
  select count(*) into n from vereine;
  perform abo_aktualisieren(v_abo, 'active', now() + interval '1 year', null, null, null, 'invoice.paid');
  r := r || format('G4b doppelte Bestaetigung: Vereine +%s; ', (select count(*) from vereine) - n);
  -- Vereinsadmin verwaltet Mitglieder wie bisher (lizenzierter Verein)
  set local role authenticated;
  perform pg_temp.als(uF);
  insert into vereins_mitglieder (user_id, verein_id, rolle_id) values (uK, v_verein, taenzer_r);
  reset role;
  r := r || format('G9 Vereinsadmin fuegt Mitglied hinzu: %s, Mitglied hat Vereinszugang=%s; ',
    exists (select 1 from vereins_mitglieder where user_id = uK and verein_id = v_verein), vereinslizenz_verein_von(uK) = v_verein);
  delete from vereins_mitglieder where user_id = uK and verein_id = v_verein;
  set local role authenticated;

  -- ===== 5/6: BASIC per Ueberweisung =====
  perform pg_temp.als(uB);
  perform vereinsgruendung_vorbereiten('Ueberweisungsclub', null);
  v_z := ueberweisung_beantragen(null, 'v1', 'Leistungsbeginn');
  select count(*) into n from vereine;
  r := r || format('G5 Ueberweisung beauftragt: Aufforderung sichtbar=%s, Verein=%s, Vereine gesamt %s; ',
    exists (select 1 from zahlungsaufforderungen where id = v_z), (select verein_id from zahlungsaufforderungen where id = v_z), n);
  begin perform abo_anlegen('verein', 'jahr', 'paypal', null); r := r || 'G5b FEHLER zweite Zahlung; ';
  exception when others then r := r || 'G5b keine zweite Zahlung parallel; '; end;
  perform pg_temp.als(uX);
  b := exists (select 1 from zahlungsaufforderungen where id = v_z);
  begin perform ueberweisung_zurueckziehen(v_z); r := r || 'G5c FEHLER Fremde zieht zurueck; ';
  exception when others then r := r || 'G5c Fremde sieht=' || b || ' und kann nicht zurueckziehen; '; end;
  begin perform admin_ueberweisung_bestaetigen(v_z); r := r || 'G5d FEHLER Nutzer bestaetigt; ';
  exception when others then r := r || 'G5d nur Admin bestaetigt; '; end;
  perform pg_temp.als(uA);
  r := r || format('G5e Admin-Liste zeigt Gruendung: %s; ',
    (select e ->> 'verein_name' from jsonb_array_elements(admin_ueberweisungen()) e where e ->> 'id' = v_z::text));
  v_rechnung := admin_ueberweisung_bestaetigen(v_z);
  select verein_id into v_verein from zahlungsaufforderungen where id = v_z;
  reset role;
  r := r || format('G6 Admin bestaetigt: Verein %s, Lizenz=%s, Vereinsadmin=%s, Rechnung an Verein=%s, BASIC-Abo unveraendert=%s; ',
    (select name from vereine where id = v_verein), verein_hat_lizenz(v_verein),
    exists (select 1 from vereins_mitglieder where user_id = uB and verein_id = v_verein),
    (select ziel_verein_id = v_verein and empfaenger_name = 'Ueberweisungsclub' from rechnungen where id = v_rechnung),
    (select status from abos where user_id = uB and inhaber = 'person'));
  set local role authenticated;

  -- Zurueckziehen und Abbrechen durch die bestellende Person
  perform pg_temp.als(uX);
  perform vereinsgruendung_vorbereiten('Abbruchverein', null);
  v_z := ueberweisung_beantragen(null, 'v1', 'Leistungsbeginn');
  perform ueberweisung_zurueckziehen(v_z);
  perform vereinsgruendung_abbrechen();
  reset role;
  r := r || format('G13 zurueckgezogen+abgebrochen: Aufforderung %s, Bestellung %s, Verein angelegt=%s; ',
    (select status from zahlungsaufforderungen where id = v_z), (select status from vereinsgruendungen where user_id = uX order by erstellt_am desc limit 1),
    exists (select 1 from vereine where name = 'Abbruchverein'));
  set local role authenticated;

  -- Person in einem Verein kann keinen weiteren Verein bestellen
  perform pg_temp.als(uM);
  begin perform vereinsgruendung_vorbereiten('Zweitverein', null); r := r || 'G12 FEHLER Mitglied bestellt; ';
  exception when others then r := r || 'G12 schon Vereinsmitglied: keine Bestellung; '; end;

  -- ===== 9: Bestandsverein ohne Lizenz kauft wie bisher =====
  v_abo := abo_anlegen('verein', 'jahr', 'stripe', vAlt);
  reset role;
  r := r || format('G10 Bestandsverein kauft Lizenz: Abo %s fuer Bestandsverein=%s; ',
    (select status from abos where id = v_abo), (select verein_id = vAlt from abos where id = v_abo));
  delete from abos where id = v_abo;
  set local role authenticated;

  -- ===== 7: TanzRaum-Admin legt Vereine an und setzt Lizenzen =====
  perform pg_temp.als(uA);
  v_verein := admin_verein_anlegen('Pilotverein Admin', 'PA');
  j := admin_vereinslizenz_setzen(v_verein, (now() at time zone 'Europe/Berlin')::date, 12, 0, 'active');
  r := r || format('G7 Admin legt Pilotverein an + Lizenz: %s; ', j ->> 'aktiv');

  -- ===== 11: kostenlose Admin-Freischaltung unveraendert =====
  j := admin_freischalten(uX, 'basic', 'kostenlos', null, 'Test');
  reset role;
  r := r || format('G11 kostenlose Freischaltung: %s; ', (select tarif from profiles where id = uX));
  set local role authenticated;
  perform admin_freischalten(uX, 'free', 'kostenlos', null, 'Test');

  -- ===== BASIC erst nach Zahlung =====
  perform pg_temp.als(uK);
  v_abo := abo_anlegen('basic', 'monat', 'paypal', null);
  reset role;
  r := r || format('G19 BASIC gekauft (ausstehend): Tarif %s; ', (select tarif from profiles where id = uK));
  perform pg_temp.als(null);
  perform abo_aktualisieren(v_abo, 'active', now() + interval '1 month', null, 'I-TEST', null, 'zahlung');
  r := r || format('G19b nach Zahlung: Tarif %s; ', (select tarif from profiles where id = uK));

  -- ===== Datenbankregel: Vereinslizenz ohne Verein nie aktiv =====
  begin insert into abos (inhaber, user_id, verein_id, tarif, periode, preis_cent, anbieter, status) values ('verein', uF, null, 'verein', 'jahr', 1, 'manuell', 'active');
    r := r || 'G20 FEHLER aktive Lizenz ohne Verein; ';
  exception when check_violation then r := r || 'G20 aktive Lizenz ohne Verein unmoeglich; '; end;

  -- ===== Verein loeschen (TanzRaum-Admin) =====
  set local role authenticated;
  perform pg_temp.als(uM);
  begin perform admin_verein_endgueltig_loeschen(vAlt, 'Bestandsverein ohne Lizenz'); r := r || 'L1 FEHLER Vereinsadmin loescht; ';
  exception when others then r := r || 'L1 nur TanzRaum-Admin loescht; '; end;
  perform pg_temp.als(uA);
  j := admin_verein_loeschen_pruefen(vAlt);
  r := r || format('L2 Pruefung: Konten %s, Hindernisse %s; ', j ->> 'konten', jsonb_array_length(j -> 'hindernisse'));
  begin perform admin_verein_endgueltig_loeschen(vAlt, 'falscher Name'); r := r || 'L3 FEHLER ohne Namensbestaetigung; ';
  exception when others then r := r || 'L3 falscher Name abgewiesen; '; end;
  select verein_id into v_verein from vereinsgruendungen where user_id = uB and status = 'abgeschlossen';
  j := admin_verein_loeschen_pruefen(v_verein);
  begin perform admin_verein_endgueltig_loeschen(v_verein, 'Ueberweisungsclub'); r := r || 'L4 FEHLER Verein mit Rechnung geloescht; ';
  exception when others then r := r || 'L4 Verein mit Rechnung/laufender Lizenz geschuetzt (' || jsonb_array_length(j -> 'hindernisse') || ' Hindernisse); '; end;
  select count(*) into n from vereine;
  j := admin_verein_endgueltig_loeschen(vAlt, '  bestandsverein OHNE lizenz ');
  r := r || format('L5 geloescht: %s, Vereine -%s, Mitgliedschaft weg=%s, Protokoll=%s; ', j ->> 'success', n - (select count(*) from vereine),
    not exists (select 1 from vereins_mitglieder where user_id = uM),
    exists (select 1 from admin_protokoll where aktion = 'verein_geloescht' and details ->> 'name' = 'Bestandsverein ohne Lizenz'));
  perform pg_temp.als(uM);
  r := r || format('L6 ehemaliger Admin kann jetzt Verein bestellen: %s; ', vereinsgruendung_vorbereiten('Neustart', null) is not null);

  raise exception 'ERGEBNIS: %', r;
end $$;
