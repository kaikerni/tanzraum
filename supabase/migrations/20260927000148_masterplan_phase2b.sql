-- TanzRaum Masterplan Phase 2b: Konto loeschen, Datenexport, Aufbewahrung von Rechnungen
--
-- Entscheidungen (Betreiber, 26.09.2026):
-- - Chatnachrichten bleiben nach der Kontoloeschung erhalten, der Absender wird anonym ("Geloeschtes Konto").
-- - Solange eine Vereinsmitgliedschaft besteht, ist die Loeschung gesperrt (erst austreten bzw. vom Verein entfernen lassen;
--   Vereinsadmins uebergeben vorher die Administration). Vereinsdaten bleiben Sache des Vereins.
-- - Loeschung nach 14 Tagen Karenz: Konto sofort gesperrt, bis dahin per Mail-Link widerrufbar.
-- - Rechnungen: Aufbewahrung 10 Jahre ab Ende des Rechnungsjahres (§ 147 AO), waehrenddessen unveraendert, abrufbar und
--   fuer TanzRaum-Admins exportierbar; danach automatische Anonymisierung, sofern keine andere Aufbewahrungspflicht
--   entgegensteht (Sperre je Rechnung durch den Admin).

-- ---------------------------------------------------------------------------------------------
-- 1) Fremdschluessel: Loeschen eines Kontos darf Vereins-, Chat- und Rechnungsdaten nicht blockieren oder mitloeschen
-- ---------------------------------------------------------------------------------------------
alter table public.nachrichten alter column sender_id drop not null;
alter table public.nachrichten drop constraint nachrichten_sender_id_fkey,
  add constraint nachrichten_sender_id_fkey foreign key (sender_id) references auth.users(id) on delete set null;
alter table public.dateien alter column hochgeladen_von drop not null;
alter table public.dateien drop constraint dateien_hochgeladen_von_fkey,
  add constraint dateien_hochgeladen_von_fkey foreign key (hochgeladen_von) references auth.users(id) on delete set null;
alter table public.einladungen alter column created_by drop not null;
alter table public.einladungen drop constraint einladungen_created_by_fkey,
  add constraint einladungen_created_by_fkey foreign key (created_by) references auth.users(id) on delete set null;
alter table public.trainings_anwesenheit alter column erfasst_von drop not null;
alter table public.trainings_anwesenheit drop constraint trainings_anwesenheit_erfasst_von_fkey,
  add constraint trainings_anwesenheit_erfasst_von_fkey foreign key (erfasst_von) references auth.users(id) on delete set null;
alter table public.trainingstermine alter column erstellt_von drop not null;
alter table public.trainingstermine drop constraint trainingstermine_erstellt_von_fkey,
  add constraint trainingstermine_erstellt_von_fkey foreign key (erstellt_von) references auth.users(id) on delete set null;
alter table public.vereins_software_verbindungen alter column erstellt_von drop not null;
alter table public.vereins_software_verbindungen drop constraint vereins_software_verbindungen_erstellt_von_fkey,
  add constraint vereins_software_verbindungen_erstellt_von_fkey foreign key (erstellt_von) references auth.users(id) on delete set null;
alter table public.vereinswechsel_anfragen alter column angefragt_von drop not null;
alter table public.vereinswechsel_anfragen drop constraint vereinswechsel_anfragen_angefragt_von_fkey,
  add constraint vereinswechsel_anfragen_angefragt_von_fkey foreign key (angefragt_von) references auth.users(id) on delete set null;
-- Rechnungen bleiben erhalten (nur die Konto-Verknuepfung entfaellt)
alter table public.rechnungen drop constraint rechnungen_ziel_user_id_fkey,
  add constraint rechnungen_ziel_user_id_fkey foreign key (ziel_user_id) references auth.users(id) on delete set null;
alter table public.ueberweisungs_rechnungen drop constraint ueberweisungs_rechnungen_ziel_user_id_fkey,
  add constraint ueberweisungs_rechnungen_ziel_user_id_fkey foreign key (ziel_user_id) references auth.users(id) on delete set null;
alter table public.ueberweisungs_rechnungen drop constraint ueberweisungs_rechnungen_check,
  add constraint ueberweisungs_rechnungen_check check (
    (typ = 'basic' and (ziel_user_id is not null or status <> 'offen')) or (typ = 'verein' and ziel_verein_id is not null));

-- ---------------------------------------------------------------------------------------------
-- 2) Rechnungen: 10 Jahre unveraendert aufbewahren, danach anonymisieren (ausser gesperrt)
-- ---------------------------------------------------------------------------------------------
alter table public.rechnungen
  add column aufbewahren_bis date generated always as (make_date(extract(year from rechnungsdatum)::int + 10, 12, 31)) stored,
  add column anonymisierung_gesperrt boolean not null default false,
  add column sperrgrund text check (sperrgrund is null or char_length(sperrgrund) <= 300),
  add column anonymisiert_am timestamptz;
comment on column public.rechnungen.aufbewahren_bis is 'Ende der Aufbewahrungsfrist (10 Jahre ab Ende des Rechnungsjahres, § 147 AO).';
comment on column public.rechnungen.anonymisierung_gesperrt is 'Andere Aufbewahrungspflicht (z. B. laufende Pruefung): keine automatische Anonymisierung.';

create or replace function public.rechnung_unveraenderlich()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $function$
begin
  if current_setting('tanzraum.rechnung_anonymisieren', true) = 'an' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if tg_op = 'DELETE' then
    raise exception 'Rechnungen unterliegen der gesetzlichen Aufbewahrungspflicht und können nicht gelöscht werden.' using errcode = '42501';
  end if;
  if (new.nummer, new.typ, new.ziel_verein_id, new.empfaenger_name, new.empfaenger_adresse, new.empfaenger_email, new.leistung,
      new.zeitraum, new.betrag, new.zahlungsweg, new.rechnungsdatum, new.erstellt_am, new.anonymisiert_am)
     is distinct from
     (old.nummer, old.typ, old.ziel_verein_id, old.empfaenger_name, old.empfaenger_adresse, old.empfaenger_email, old.leistung,
      old.zeitraum, old.betrag, old.zahlungsweg, old.rechnungsdatum, old.erstellt_am, old.anonymisiert_am) then
    raise exception 'Rechnungsdaten bleiben während der Aufbewahrungsfrist unverändert.' using errcode = '42501';
  end if;
  return new;
end;
$function$;
create trigger rechnung_unveraenderlich before update or delete on public.rechnungen
  for each row execute function public.rechnung_unveraenderlich();

-- Nach Fristablauf: personenbezogene Empfaengerdaten entfernen; Nummer, Datum, Leistung und Betrag bleiben (keine Personen)
create or replace function public.rechnungen_anonymisieren()
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_anzahl integer;
begin
  perform set_config('tanzraum.rechnung_anonymisieren', 'an', true);
  update rechnungen set empfaenger_name = 'anonymisiert', empfaenger_adresse = null, empfaenger_email = 'anonymisiert',
                        ziel_user_id = null, anonymisiert_am = now()
  where aufbewahren_bis < current_date and anonymisiert_am is null and not anonymisierung_gesperrt;
  get diagnostics v_anzahl = row_count;
  perform set_config('tanzraum.rechnung_anonymisieren', '', true);
  return v_anzahl;
end;
$function$;
revoke all on function public.rechnungen_anonymisieren(), public.rechnung_unveraenderlich() from public, anon, authenticated;

-- Sperre/Freigabe der Anonymisierung durch Plattform-Admins
create or replace function public.rechnung_aufbewahrung_sperren(p_rechnung uuid, p_gesperrt boolean, p_grund text)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if not ist_plattform_admin_aktuell() then
    raise exception 'Nur für die TanzRaum-Administration.' using errcode = '42501';
  end if;
  if coalesce(p_gesperrt, false) and nullif(btrim(coalesce(p_grund, '')), '') is null then
    raise exception 'Bitte den Grund für die weitere Aufbewahrung angeben.' using errcode = 'P0001';
  end if;
  update rechnungen set anonymisierung_gesperrt = coalesce(p_gesperrt, false),
                        sperrgrund = case when coalesce(p_gesperrt, false) then left(btrim(p_grund), 300) end
  where id = p_rechnung;
end;
$function$;
revoke all on function public.rechnung_aufbewahrung_sperren(uuid, boolean, text) from public, anon;
grant execute on function public.rechnung_aufbewahrung_sperren(uuid, boolean, text) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- 3) Konto loeschen: Pruefung, Antrag (Sperre + 14 Tage Karenz), Widerruf, Ausfuehrung
-- ---------------------------------------------------------------------------------------------
create table public.konto_loeschungen (
  user_id uuid primary key references auth.users(id) on delete cascade,
  beantragt_am timestamptz not null default now(),
  loeschen_ab timestamptz not null default now() + interval '14 days',
  widerruf_token_hash text,
  token_laeuft_ab timestamptz,
  mails_gesendet integer not null default 0,
  letzte_mail_am timestamptz,
  zuletzt_blockiert text
);
comment on table public.konto_loeschungen is 'Beantragte Kontoloeschungen (Konto gesperrt, endgueltige Loeschung nach Ablauf von loeschen_ab).';
alter table public.konto_loeschungen enable row level security;
create policy "Eigenen Loeschantrag sehen" on public.konto_loeschungen for select to authenticated using (user_id = auth.uid());
revoke all on table public.konto_loeschungen from public, anon;
grant select on table public.konto_loeschungen to authenticated;
grant all on table public.konto_loeschungen to service_role;

-- Nur die Anzahl endgueltig geloeschter Konten (kein Personenbezug)
create table public.konto_loeschung_protokoll (
  id bigint generated always as identity primary key,
  geloescht_am timestamptz not null default now(),
  anzahl integer not null
);
alter table public.konto_loeschung_protokoll enable row level security;
create policy "Plattformadmin sieht Loeschprotokoll" on public.konto_loeschung_protokoll for select to authenticated
  using (ist_plattform_admin_aktuell());
revoke all on table public.konto_loeschung_protokoll from public, anon;
grant select on table public.konto_loeschung_protokoll to authenticated;
grant all on table public.konto_loeschung_protokoll to service_role;

-- Gruende gegen eine Loeschung (leer = Loeschung moeglich)
create or replace function public.konto_loeschung_hindernisse(p_user uuid)
 returns table(grund text, text text)
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  v_vereine text;
begin
  select string_agg(v.name, ', ' order by v.name) into v_vereine
  from vereins_mitglieder vm join vereine v on v.id = vm.verein_id where vm.user_id = p_user;
  if v_vereine is not null then
    return query select 'verein'::text,
      format('Du bist noch Mitglied in: %s. Bitte tritt zuerst aus bzw. lass dich vom Vereinsadmin entfernen. Bist du Vereinsadmin, übergib die Administration vorher an eine andere Person.', v_vereine);
  end if;
  if exists (select 1 from abos a where a.user_id = p_user and a.status in ('pending', 'active', 'trialing', 'past_due', 'paused_by_organization')
             and a.gekuendigt_zum is null) then
    return query select 'lizenz'::text, 'Bitte kündige zuerst deine BASIC-Lizenz unter „Mein Tarif“.'::text;
  end if;
  if exists (select 1 from ueberweisungs_rechnungen u where u.ziel_user_id = p_user and u.status = 'offen') then
    return query select 'offene_zahlung'::text, 'Es gibt noch eine offene Zahlung per Überweisung. Bitte begleiche oder storniere sie zuerst (Support).'::text;
  end if;
  if exists (select 1 from profiles p where p.id = p_user and p.ist_plattform_admin) then
    return query select 'plattformadmin'::text, 'Konten der TanzRaum-Administration können nicht selbst gelöscht werden.'::text;
  end if;
  if exists (select 1 from juryraum_besetzungen where created_by = p_user)
     or exists (select 1 from juryraum_einladungen where eingeladen_von = p_user)
     or exists (select 1 from juryraum_einsatz_zusagen where eingeladen_von = p_user)
     or exists (select 1 from juryraum_fahrgemeinschaften where created_by = p_user)
     or exists (select 1 from juryraum_fernwartungs_zugriff where gewaehrt_von = p_user)
     or exists (select 1 from juryraum_unterkuenfte where created_by = p_user) then
    return query select 'juryraum'::text, 'Du hast im JuryRaum noch Einträge angelegt. Bitte melde dich beim Support, damit sie übergeben werden.'::text;
  end if;
end;
$function$;
revoke all on function public.konto_loeschung_hindernisse(uuid) from public, anon, authenticated;

create or replace function public.mein_konto_loeschung_status()
 returns table(beantragt boolean, loeschen_ab timestamptz, hindernisse jsonb)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select exists (select 1 from konto_loeschungen k where k.user_id = auth.uid()),
         (select k.loeschen_ab from konto_loeschungen k where k.user_id = auth.uid()),
         coalesce((select jsonb_agg(jsonb_build_object('grund', h.grund, 'text', h.text)) from konto_loeschung_hindernisse(auth.uid()) h), '[]'::jsonb)
  where auth.uid() is not null;
$function$;
revoke all on function public.mein_konto_loeschung_status() from public, anon;
grant execute on function public.mein_konto_loeschung_status() to authenticated;

-- Antrag: nur ohne Hindernisse; Konto wird sofort gesperrt und abgemeldet
create or replace function public.konto_loeschung_beantragen()
 returns timestamptz
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_user uuid := auth.uid();
  v_hindernis text;
  v_ab timestamptz;
begin
  if v_user is null then raise exception 'Nicht angemeldet.' using errcode = '42501'; end if;
  select h.text into v_hindernis from konto_loeschung_hindernisse(v_user) h limit 1;
  if v_hindernis is not null then raise exception '%', v_hindernis using errcode = 'P0001'; end if;
  insert into konto_loeschungen (user_id) values (v_user)
  on conflict (user_id) do update set beantragt_am = konto_loeschungen.beantragt_am
  returning loeschen_ab into v_ab;
  update auth.users set banned_until = '2999-12-31'::timestamptz where id = v_user;
  delete from auth.sessions where user_id = v_user;
  return v_ab;
end;
$function$;
revoke all on function public.konto_loeschung_beantragen() from public, anon;
grant execute on function public.konto_loeschung_beantragen() to authenticated;

-- Widerruf per Link aus der Bestaetigungsmail (ohne Anmeldung; Token nur als Hash gespeichert)
create or replace function public.konto_loeschung_widerrufen(p_token text)
 returns boolean
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_user uuid;
begin
  select k.user_id into v_user from konto_loeschungen k
  where k.widerruf_token_hash is not null and k.token_laeuft_ab > now() and k.loeschen_ab > now()
    and k.widerruf_token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex')
  for update;
  if v_user is null then
    raise exception 'Dieser Link ist ungültig oder abgelaufen.' using errcode = 'P0001';
  end if;
  delete from konto_loeschungen where user_id = v_user;
  -- Sperre aufheben (Kinderkonten ohne Elternzustimmung bleiben ueber kinderkonto_sperre_halten gesperrt)
  update auth.users set banned_until = null where id = v_user;
  return true;
end;
$function$;
revoke all on function public.konto_loeschung_widerrufen(text) from public;
grant execute on function public.konto_loeschung_widerrufen(text) to anon, authenticated;

-- Faellige Loeschungen fuer die Edge Function (Cron, Geheimnis aus dem Vault); prueft Hindernisse erneut
create or replace function public.konto_loeschungen_faellig(p_geheimnis text)
 returns table(user_id uuid, storage jsonb)
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  k record;
  v_hindernis text;
begin
  if not interner_aufruf_ok(p_geheimnis) then
    raise exception 'Nicht berechtigt' using errcode = '42501';
  end if;
  for k in select * from konto_loeschungen where loeschen_ab <= now() order by loeschen_ab limit 50 loop
    select h.text into v_hindernis from konto_loeschung_hindernisse(k.user_id) h limit 1;
    if v_hindernis is not null then
      update konto_loeschungen set zuletzt_blockiert = v_hindernis where konto_loeschungen.user_id = k.user_id;
      continue;
    end if;
    -- Eigene Dateien, die mit dem Konto verschwinden (Spotlights, persoenliche Dateien); Chat-Anhaenge bleiben
    return query select k.user_id, jsonb_build_object(
      'spotlights', coalesce((select jsonb_agg(s.media_path) from spotlights s where s.user_id = k.user_id and s.media_path is not null), '[]'::jsonb),
      'vereins-dateien', coalesce((select jsonb_agg(d.storage_path) from dateien d where d.user_id = k.user_id and d.storage_path is not null), '[]'::jsonb));
  end loop;
end;
$function$;

create or replace function public.konto_endgueltig_loeschen(p_geheimnis text, p_user uuid)
 returns boolean
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if not interner_aufruf_ok(p_geheimnis) then
    raise exception 'Nicht berechtigt' using errcode = '42501';
  end if;
  if not exists (select 1 from konto_loeschungen k where k.user_id = p_user and k.loeschen_ab <= now())
     or exists (select 1 from konto_loeschung_hindernisse(p_user)) then
    return false;
  end if;
  delete from auth.users where id = p_user;
  insert into konto_loeschung_protokoll (anzahl) values (1);
  return true;
end;
$function$;
revoke all on function public.konto_loeschungen_faellig(text), public.konto_endgueltig_loeschen(text, uuid) from public, anon, authenticated;
grant execute on function public.konto_loeschungen_faellig(text), public.konto_endgueltig_loeschen(text, uuid) to service_role;

-- ---------------------------------------------------------------------------------------------
-- 4) Datenexport (Art. 15/20 DSGVO): ausschliesslich Daten der angemeldeten Person
-- ---------------------------------------------------------------------------------------------
create or replace function public.meine_daten_export()
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  v_user uuid := auth.uid();
  v_vm uuid[];
  v_ergebnis jsonb;
  v_teil jsonb;
  t record;
begin
  if v_user is null then raise exception 'Nicht angemeldet.' using errcode = '42501'; end if;
  select coalesce(array_agg(vm.id), '{}') into v_vm from vereins_mitglieder vm where vm.user_id = v_user;

  v_ergebnis := jsonb_build_object(
    'erstellt_am', now(),
    'hinweis', 'Export deiner bei TanzRaum gespeicherten Daten. Enthält nur Daten zu deinem Konto; Daten anderer Personen sind nicht enthalten (Verweise auf andere Personen nur als interne Kennung).',
    'konto', (select jsonb_build_object('id', u.id, 'email', u.email, 'registriert_am', u.created_at, 'letzte_anmeldung', u.last_sign_in_at,
                                        'email_bestaetigt_am', u.email_confirmed_at) from auth.users u where u.id = v_user),
    'profil', (select to_jsonb(p) from profiles p where p.id = v_user),
    'gesendete_nachrichten', (select coalesce(jsonb_agg(jsonb_build_object('id', n.id, 'gespraech_id', n.gespraech_id, 'inhalt', n.inhalt,
                                'bild_pfad', n.bild_pfad, 'anhang', n.anhang, 'standort', n.standort, 'gesendet_am', n.gesendet_am,
                                'geloescht_am', n.geloescht_am) order by n.gesendet_am), '[]'::jsonb)
                              from nachrichten n where n.sender_id = v_user),
    'rechnungen', (select coalesce(jsonb_agg(to_jsonb(r) order by r.rechnungsdatum), '[]'::jsonb) from rechnungen r where r.ziel_user_id = v_user)
  );

  -- Tabellen mit direktem Personenbezug (Spalte = eigene Kennung); technische Geheimnisse ausgenommen
  for t in select * from (values
      ('abos', 'user_id', array[]::text[]), ('beitritts_anfragen', 'user_id', array[]::text[]),
      ('benachrichtigungen', 'user_id', array[]::text[]), ('blockierungen', 'blocker_id', array[]::text[]),
      ('chat_stumm', 'user_id', array[]::text[]), ('connections', 'user_id', array[]::text[]),
      ('dateien', 'user_id', array[]::text[]), ('eigene_kontakte', 'user_id', array[]::text[]),
      ('eigene_vereinsnotizen', 'user_id', array[]::text[]), ('einwilligungen', 'user_id', array[]::text[]),
      ('eltern_verknuepfungen', 'kind_id', array[]::text[]), ('eltern_verknuepfungen', 'eltern_id', array[]::text[]),
      ('eltern_zustimmungen', 'kind_id', array['token_hash', 'verknuepf_token_hash', 'eltern_email']),
      ('gespraech_teilnehmer', 'user_id', array[]::text[]), ('juryraum_einsatz_zusagen', 'user_id', array[]::text[]),
      ('juryraum_mitglieder', 'user_id', array[]::text[]), ('juryraum_verfuegbarkeiten', 'user_id', array[]::text[]),
      ('kind_einstellungen', 'kind_id', array[]::text[]), ('login_ips', 'user_id', array[]::text[]),
      ('meldungen', 'melder_id', array[]::text[]), ('mitglieder', 'user_id', array[]::text[]),
      ('mitgliedsantraege', 'user_id', array[]::text[]), ('nachricht_reaktionen', 'user_id', array[]::text[]),
      ('onboarding_progress', 'user_id', array[]::text[]), ('push_einstellungen', 'user_id', array[]::text[]),
      ('push_subscriptions', 'user_id', array['p256dh', 'auth', 'endpoint']), ('spotlight_reactions', 'user_id', array[]::text[]),
      ('spotlights', 'user_id', array[]::text[]), ('tarif_ereignisse', 'user_id', array[]::text[]),
      ('turnier_merkliste', 'user_id', array[]::text[]), ('umfrage_stimmen', 'user_id', array[]::text[]),
      ('vereins_lizenz_abdeckungen', 'user_id', array[]::text[]), ('vereins_mitglieder', 'user_id', array[]::text[]),
      ('vereinswechsel_anfragen', 'mitglied_user_id', array[]::text[]), ('konto_loeschungen', 'user_id', array['widerruf_token_hash'])
    ) x(tabelle, spalte, ohne)
  loop
    if to_regclass('public.' || t.tabelle) is null then continue; end if;
    execute format('select coalesce(jsonb_agg(to_jsonb(q) - $2), ''[]''::jsonb) from public.%I q where q.%I = $1', t.tabelle, t.spalte)
      into v_teil using v_user, t.ohne;
    v_ergebnis := v_ergebnis || jsonb_build_object(t.tabelle || case when t.tabelle = 'eltern_verknuepfungen' then '_als_' || t.spalte else '' end, v_teil);
  end loop;

  -- Vereinsdaten zur eigenen Mitgliedschaft
  for t in select * from (values
      ('beitraege'), ('formation_mitglieder'), ('gruppen_mitglieder'), ('kostueme'), ('mitglied_ehrungen'), ('mitglied_funktionen'),
      ('mitglied_zeitraeume'), ('termin_rueckmeldungen'), ('trainings_abmeldungen'), ('trainings_anwesenheit'),
      ('turnier_start_rueckmeldungen'), ('vereins_bereichsrechte')
    ) x(tabelle)
  loop
    if to_regclass('public.' || t.tabelle) is null then continue; end if;
    execute format('select coalesce(jsonb_agg(to_jsonb(q)), ''[]''::jsonb) from public.%I q where q.vereins_mitglied_id = any($1)', t.tabelle)
      into v_teil using v_vm;
    v_ergebnis := v_ergebnis || jsonb_build_object('verein_' || t.tabelle, v_teil);
  end loop;

  return v_ergebnis;
end;
$function$;
revoke all on function public.meine_daten_export() from public, anon;
grant execute on function public.meine_daten_export() to authenticated;

-- ---------------------------------------------------------------------------------------------
-- 5) Zeitplaene: faellige Kontoloeschungen (Edge Function konto-loeschung) und Rechnungs-Anonymisierung
-- ---------------------------------------------------------------------------------------------
select cron.schedule('konto-loeschungen', '50 3 * * *', $cron$
  select net.http_post(
    url := 'https://oraiqjulxmohclfixwdq.supabase.co/functions/v1/konto-loeschung',
    headers := jsonb_build_object('Content-Type','application/json','x-tanzraum-geheimnis',(select decrypted_secret from vault.decrypted_secrets where name = 'chat_push_geheimnis')),
    body := '{"art":"ausfuehren"}'::jsonb
  );
$cron$);
select cron.schedule('rechnungen-anonymisieren', '10 4 * * *', 'select public.rechnungen_anonymisieren()');
