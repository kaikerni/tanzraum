-- Einheitliche Altersgrenze 16 und dokumentierte Elternzustimmung fuer Kinderkonten
--
-- Regeln:
--   unter 16  -> Kinderkonto: Anmeldung erst nach Zustimmung eines Elternteils bzw. Traegers der elterlichen
--                Verantwortung; Schutzvoreinstellungen (Karte aus, Spotlights nur Verein/Kontakte, Push nur mit
--                Einwilligung der Eltern); Kommunikationsschutz (bisher "unter 15")
--   ab 16     -> eigenstaendiges Konto
--   ab 18     -> nur dort, wo Volljaehrigkeit gebraucht wird (Elternteil bei Verknuepfung/Zustimmung)
--
-- Sperre: Solange die Zustimmung fehlt, ist das Login in Supabase Auth gesperrt (banned_until = SPERRE). Damit ist
-- auch ueber direkte API-Aufrufe keine Sitzung moeglich. Neu registrierte Kinderkonten ohne Zustimmung werden nach
-- 14 Tagen geloescht; Bestandskonten werden nie automatisch geloescht.

-- ---------------------------------------------------------------------------------------------
-- 1) Altersfunktionen
-- ---------------------------------------------------------------------------------------------
create or replace function public.ist_unter_16(p_user_id uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  -- Kinderkonto-/Jugendschutzgrenze: bis zum Tag vor dem 16. Geburtstag.
  -- Ohne bekanntes Geburtsdatum gilt der Schutz (ausser fuer die Plattform-Administration).
  select case
    when p_user_id is null then true
    when exists (select 1 from profiles p where p.id = p_user_id and p.ist_plattform_admin) then false
    when geburtsdatum_von(p_user_id) is null then true
    else (geburtsdatum_von(p_user_id) + interval '16 years')::date > (now() at time zone 'Europe/Berlin')::date
  end;
$function$;

-- Volljaehrigkeit (18) – nur fuer Elternteile (Zustimmung/Verknuepfung), keine allgemeine TanzRaum-Grenze
create or replace function public.ist_volljaehrig(p_user_id uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select geburtsdatum_von(p_user_id) is not null
     and (geburtsdatum_von(p_user_id) + interval '18 years')::date <= (now() at time zone 'Europe/Berlin')::date;
$function$;

create or replace function public.datum_unter_16(p_datum date)
 returns boolean
 language sql
 stable
 set search_path to 'public'
as $function$
  select p_datum is not null and (p_datum + interval '16 years')::date > (now() at time zone 'Europe/Berlin')::date;
$function$;

-- ---------------------------------------------------------------------------------------------
-- 2) Elternzustimmung
-- ---------------------------------------------------------------------------------------------
create table public.eltern_zustimmungen (
  id uuid primary key default gen_random_uuid(),
  kind_id uuid not null references auth.users(id) on delete cascade,
  -- 'registrierung' = neu registriertes Kinderkonto (Loeschung nach 14 Tagen ohne Zustimmung)
  -- 'bestandskonto' = bestehendes Konto, das unter 16 ist (wird nie automatisch geloescht)
  herkunft text not null check (herkunft in ('registrierung', 'bestandskonto')),
  status text not null default 'offen' check (status in ('offen', 'zugestimmt', 'abgelehnt')),
  -- Adresse, an die der Zustimmungslink ging (Nachweis der Zustimmung, Art. 7 Abs. 1 DSGVO)
  eltern_email text not null check (eltern_email ~ '^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$'),
  angefragt_am timestamptz not null default now(),
  loeschen_ab timestamptz,
  konto_gesperrt boolean not null default false,
  -- Einmaliger Zustimmungslink (nur Hash gespeichert)
  token_hash text,
  token_laeuft_ab timestamptz,
  mails_gesendet integer not null default 0,
  letzte_mail_am timestamptz,
  -- Entscheidung und Nachweis
  entschieden_am timestamptz,
  erklaerung_volljaehrig boolean,
  erklaerung_sorgeberechtigt boolean,
  umfang jsonb,
  textversion text,
  freigeschaltet_am timestamptz,
  -- Optionales Elternkonto (spaeter verknuepft) und einmaliger Verknuepfungslink
  eltern_id uuid references auth.users(id) on delete set null,
  verknuepf_token_hash text,
  verknuepf_laeuft_ab timestamptz,
  bestaetigung_gesendet_am timestamptz,
  constraint eltern_zustimmungen_zugestimmt check (
    status <> 'zugestimmt' or (erklaerung_volljaehrig and erklaerung_sorgeberechtigt and umfang is not null
                               and textversion is not null and entschieden_am is not null))
);
create unique index eltern_zustimmungen_offen_idx on public.eltern_zustimmungen (kind_id) where status = 'offen';
create index eltern_zustimmungen_kind_idx on public.eltern_zustimmungen (kind_id);
create index eltern_zustimmungen_token_idx on public.eltern_zustimmungen (token_hash) where token_hash is not null;
create index eltern_zustimmungen_verknuepf_idx on public.eltern_zustimmungen (verknuepf_token_hash) where verknuepf_token_hash is not null;
comment on table public.eltern_zustimmungen is
  'Dokumentierte Zustimmung eines Elternteils bzw. Traegers der elterlichen Verantwortung fuer Kinderkonten unter 16. Keine Identitaetspruefung: Nachweis ist die Erklaerung ueber den einmaligen Link an die angegebene Adresse.';

-- Nachvollziehbarkeit der 14-Tage-Loeschung (ohne personenbezogene Daten)
create table public.kinderkonto_loeschungen (
  id bigint generated always as identity primary key,
  geloescht_am timestamptz not null default now(),
  anzahl integer not null
);

alter table public.eltern_zustimmungen enable row level security;
alter table public.kinderkonto_loeschungen enable row level security;
-- Lesen: das Kind (eigener Status), das verknuepfte Elternteil, die Plattform-Administration.
-- Schreiben ausschliesslich ueber die Funktionen unten bzw. die Edge Function (Service-Rolle).
create policy "Elternzustimmung: Kind, Elternteil, Plattform-Admin lesen" on public.eltern_zustimmungen for select to authenticated
  using (kind_id = auth.uid() or eltern_id = auth.uid() or ist_plattform_admin_aktuell());
create policy "Kinderkonto-Loeschungen: Plattform-Admin" on public.kinderkonto_loeschungen for select to authenticated
  using (ist_plattform_admin_aktuell());
revoke all on table public.eltern_zustimmungen, public.kinderkonto_loeschungen from public, anon;
grant select on table public.eltern_zustimmungen, public.kinderkonto_loeschungen to authenticated;
grant all on table public.eltern_zustimmungen, public.kinderkonto_loeschungen to service_role;

-- Version der Texte, denen zugestimmt wird (Zustimmungsseite, Datenschutzerklaerung, Nutzungsbedingungen)
create or replace function public.zustimmung_textversion()
 returns text
 language sql
 immutable
as $function$
  select 'eltern-zustimmung-v1 | datenschutz 26.09.2026 | nutzungsbedingungen 26.09.2026'::text;
$function$;

-- Sperrzeitpunkt, an dem TanzRaum eine eigene Login-Sperre erkennt (Admin-Sperren bleiben unberuehrt)
create or replace function public.kinderkonto_sperre()
 returns timestamptz
 language sql
 immutable
as $function$
  select timestamptz '2999-12-31 00:00:00+00';
$function$;

create or replace function public.elternzustimmung_vorhanden(p_kind uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select exists (select 1 from eltern_zustimmungen z where z.kind_id = p_kind and z.status = 'zugestimmt');
$function$;

-- Login sperren und laufende Sitzungen beenden (nur TanzRaum-eigene Sperre)
create or replace function public.kinderkonto_login_sperren(p_kind uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  update auth.users set banned_until = kinderkonto_sperre() where id = p_kind and banned_until is null;
  delete from auth.sessions where user_id = p_kind;
end;
$function$;

create or replace function public.kinderkonto_login_freigeben(p_kind uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  update auth.users set banned_until = null where id = p_kind and banned_until = kinderkonto_sperre();
end;
$function$;

-- Status fuer die Oberflaeche: frei | geburtsdatum_fehlt | zustimmung_noetig | wartet
create or replace function public.mein_kinderkonto_status()
 returns text
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select case
    when auth.uid() is null then 'frei'
    when exists (select 1 from profiles p where p.id = auth.uid() and p.ist_plattform_admin) then 'frei'
    when geburtsdatum_von(auth.uid()) is null then 'geburtsdatum_fehlt'
    when not ist_unter_16(auth.uid()) then 'frei'
    when elternzustimmung_vorhanden(auth.uid()) then 'frei'
    when exists (select 1 from eltern_zustimmungen z where z.kind_id = auth.uid() and z.status = 'offen') then 'wartet'
    else 'zustimmung_noetig'
  end;
$function$;

-- Zustimmung fuer ein angemeldetes Konto unter 16 anfordern (Bestandskonto ohne dokumentierte Zustimmung).
-- Sperrt das Login bis zur Zustimmung; der Link wird von der Edge Function "eltern-zustimmung" versendet.
create or replace function public.eltern_zustimmung_anfordern(p_eltern_email text)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_email text := lower(btrim(coalesce(p_eltern_email, '')));
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet.' using errcode = '42501'; end if;
  if mein_kinderkonto_status() <> 'zustimmung_noetig' then
    raise exception 'Für dieses Konto ist keine Zustimmung der Eltern nötig.' using errcode = 'P0001';
  end if;
  if v_email !~ '^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$' or length(v_email) > 254 then
    raise exception 'Bitte gib eine gültige E-Mail-Adresse deiner Eltern ein.' using errcode = 'P0001';
  end if;
  if v_email = lower((select u.email from auth.users u where u.id = auth.uid())) then
    raise exception 'Bitte gib die E-Mail-Adresse eines Elternteils ein – nicht deine eigene.' using errcode = 'P0001';
  end if;
  insert into eltern_zustimmungen (kind_id, herkunft, eltern_email, konto_gesperrt)
  values (auth.uid(), 'bestandskonto', v_email, true)
  returning id into v_id;
  perform kinderkonto_login_sperren(auth.uid());
  return v_id;
end;
$function$;

-- Angaben fuer die Zustimmungsseite (nur mit gueltigem Link)
create or replace function public.eltern_zustimmung_info(p_token text)
 returns table(vorname text, nachname text, geburtsdatum date, alter_jahre integer, textversion text)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select p.vorname, p.nachname, p.geburtsdatum,
         extract(year from age((now() at time zone 'Europe/Berlin')::date, p.geburtsdatum))::int,
         zustimmung_textversion()
  from eltern_zustimmungen z join profiles p on p.id = z.kind_id
  where z.status = 'offen' and z.token_hash is not null and z.token_laeuft_ab > now()
    and z.token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex');
$function$;

-- Entscheidung des Elternteils. Der Link ist danach verbraucht.
create or replace function public.eltern_zustimmung_entscheiden(p_token text, p_zustimmen boolean, p_volljaehrig boolean,
                                                                p_sorgeberechtigt boolean, p_push boolean, p_textversion text)
 returns table(ergebnis text, zustimmung_id uuid, kind_email_bestaetigen text)
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  z eltern_zustimmungen%rowtype;
  v_email text;
begin
  select * into z from eltern_zustimmungen x
  where x.status = 'offen' and x.token_hash is not null and x.token_laeuft_ab > now()
    and x.token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex')
  for update;
  if z.id is null then
    raise exception 'Dieser Link ist ungültig, abgelaufen oder wurde bereits verwendet.' using errcode = 'P0001';
  end if;
  if p_textversion is distinct from zustimmung_textversion() then
    raise exception 'Die Zustimmungstexte wurden aktualisiert. Bitte lade die Seite neu.' using errcode = 'P0001';
  end if;

  if not coalesce(p_zustimmen, false) then
    if z.herkunft = 'registrierung' then
      -- Keine Zustimmung: neu angelegtes Kinderkonto sofort loeschen (inkl. Profil und Zustimmungsdatensatz)
      delete from auth.users where id = z.kind_id;
      return query select 'abgelehnt_geloescht'::text, null::uuid, null::text;
    else
      update eltern_zustimmungen set status = 'abgelehnt', entschieden_am = now(), token_hash = null, token_laeuft_ab = null
      where id = z.id;
      return query select 'abgelehnt'::text, z.id, null::text;
    end if;
    return;
  end if;

  if not (coalesce(p_volljaehrig, false) and coalesce(p_sorgeberechtigt, false)) then
    raise exception 'Bitte bestätige, dass du volljährig und Träger der elterlichen Verantwortung bist.' using errcode = 'P0001';
  end if;

  update eltern_zustimmungen set
    status = 'zugestimmt', entschieden_am = now(), erklaerung_volljaehrig = true, erklaerung_sorgeberechtigt = true,
    umfang = jsonb_build_object('kinderkonto', true, 'push', coalesce(p_push, false)),
    textversion = zustimmung_textversion(), freigeschaltet_am = now(), loeschen_ab = null,
    token_hash = null, token_laeuft_ab = null
  where id = z.id;
  if z.konto_gesperrt then
    perform kinderkonto_login_freigeben(z.kind_id);
  end if;
  insert into benachrichtigungen (user_id, typ, text)
  values (z.kind_id, 'eltern', 'Deine Eltern haben deinem TanzRaum-Konto zugestimmt. Viel Spaß!');
  -- Neu registrierte Kinderkonten bestaetigen danach ihre E-Mail-Adresse (Mail wird erst jetzt versendet)
  select u.email into v_email from auth.users u where u.id = z.kind_id and u.email_confirmed_at is null;
  return query select 'zugestimmt'::text, z.id, v_email;
end;
$function$;

-- Optionales Elternkonto mit dem Kinderkonto verknuepfen (Link aus der Bestaetigungs-Mail, E-Mail muss passen)
create or replace function public.eltern_verknuepfen_mit_zustimmung(p_token text)
 returns text
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  z eltern_zustimmungen%rowtype;
  v_name text;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet.' using errcode = '42501'; end if;
  select * into z from eltern_zustimmungen x
  where x.status = 'zugestimmt' and x.verknuepf_token_hash is not null and x.verknuepf_laeuft_ab > now()
    and x.verknuepf_token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex')
  for update;
  if z.id is null then
    raise exception 'Dieser Link ist ungültig, abgelaufen oder wurde bereits verwendet.' using errcode = 'P0001';
  end if;
  if lower((select u.email from auth.users u where u.id = auth.uid())) is distinct from lower(z.eltern_email) then
    raise exception 'Bitte melde dich mit der E-Mail-Adresse an, an die der Link geschickt wurde.' using errcode = 'P0001';
  end if;
  if not ist_volljaehrig(auth.uid()) then
    raise exception 'Nur volljährige Konten mit eingetragenem Geburtsdatum können sich als Elternteil verknüpfen.' using errcode = 'P0001';
  end if;
  if z.kind_id = auth.uid() or ist_blockiert(auth.uid(), z.kind_id) then
    raise exception 'Diese Verknüpfung ist nicht möglich.' using errcode = 'P0001';
  end if;
  insert into eltern_verknuepfungen (eltern_id, kind_id, status, bestaetigt_am)
  values (auth.uid(), z.kind_id, 'bestaetigt', now())
  on conflict do nothing;
  update eltern_verknuepfungen set status = 'bestaetigt', bestaetigt_am = coalesce(bestaetigt_am, now())
  where eltern_id = auth.uid() and kind_id = z.kind_id;
  update eltern_zustimmungen set eltern_id = auth.uid(), verknuepf_token_hash = null, verknuepf_laeuft_ab = null where id = z.id;
  v_name := coalesce((select a.anzeige from anzeige_namen(array[auth.uid()]) a), 'Ein Elternteil');
  insert into benachrichtigungen (user_id, typ, text) values (z.kind_id, 'eltern', v_name || ' ist jetzt als Elternteil mit deinem Konto verknüpft.');
  return 'bestaetigt';
end;
$function$;

-- Auth-Mail-Hook: Mails an wartende Kinderkonten unterdruecken (Bestaetigung erst nach der Zustimmung).
-- p_geburtsdatum = Angabe aus der Registrierung (der Datensatz ist waehrend der Registrierung noch nicht sichtbar).
create or replace function public.kinderkonto_mail_unterdruecken(p_user uuid, p_geburtsdatum text)
 returns boolean
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  v_geb date;
begin
  if exists (select 1 from eltern_zustimmungen z where z.kind_id = p_user and z.status in ('offen', 'abgelehnt') and z.konto_gesperrt)
     and not elternzustimmung_vorhanden(p_user) then
    return true;
  end if;
  begin
    v_geb := case when p_geburtsdatum ~ '^\d{4}-\d{2}-\d{2}$' then p_geburtsdatum::date end;
  exception when others then v_geb := null;
  end;
  return datum_unter_16(v_geb) and not elternzustimmung_vorhanden(p_user);
end;
$function$;

-- 14-Tage-Loeschung nicht bestaetigter, neu registrierter Kinderkonten (Bestandskonten nie)
create or replace function public.kinderkonten_aufraeumen()
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_anzahl integer;
begin
  with weg as (
    delete from auth.users u
    where u.id in (select z.kind_id from eltern_zustimmungen z
                   where z.herkunft = 'registrierung' and z.status = 'offen' and z.loeschen_ab < now())
      and not exists (select 1 from eltern_zustimmungen z2 where z2.kind_id = u.id and z2.status = 'zugestimmt')
    returning u.id)
  select count(*) into v_anzahl from weg;
  if v_anzahl > 0 then
    insert into kinderkonto_loeschungen (anzahl) values (v_anzahl);
  end if;
  return v_anzahl;
end;
$function$;

-- Sicherheitsnetz: Solange eine Zustimmung offen ist, bleibt die TanzRaum-Sperre bestehen, auch wenn Supabase Auth
-- den Benutzer spaeter aktualisiert.
create or replace function public.kinderkonto_sperre_halten()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  begin
    if new.banned_until is distinct from kinderkonto_sperre()
       and exists (select 1 from public.eltern_zustimmungen z where z.kind_id = new.id and z.status = 'offen' and z.konto_gesperrt)
       and not exists (select 1 from public.eltern_zustimmungen z where z.kind_id = new.id and z.status = 'zugestimmt') then
      new.banned_until := kinderkonto_sperre();
    end if;
  exception when others then
    null; -- Auth-Vorgaenge nie an diesem Trigger scheitern lassen
  end;
  return new;
end;
$function$;
create trigger kinderkonto_sperre_halten before update on auth.users
  for each row execute function public.kinderkonto_sperre_halten();

-- ---------------------------------------------------------------------------------------------
-- 3) Registrierung: Alter serverseitig pruefen, Kinderkonto unter 16 sperren und Zustimmung anlegen
-- ---------------------------------------------------------------------------------------------
create or replace function public.handle_new_user()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_geb date;
  v_eltern text := lower(btrim(coalesce(new.raw_user_meta_data->>'eltern_email', '')));
begin
  begin
    if (new.raw_user_meta_data->>'geburtsdatum') ~ '^\d{4}-\d{2}-\d{2}$' then
      v_geb := (new.raw_user_meta_data->>'geburtsdatum')::date;
      if v_geb > current_date or v_geb < date '1900-01-01' then v_geb := null; end if;
    end if;
  exception when others then v_geb := null;
  end;
  -- Unter 16 nur mit E-Mail-Adresse eines Elternteils (serverseitig, auch bei direkten API-Aufrufen)
  if datum_unter_16(v_geb) then
    if v_eltern !~ '^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$' or length(v_eltern) > 254 or v_eltern = lower(coalesce(new.email, '')) then
      raise exception 'Unter 16 Jahren ist die Registrierung nur mit der E-Mail-Adresse eines Elternteils möglich.' using errcode = 'P0001';
    end if;
  end if;
  insert into public.profiles (id, vorname, nachname, handle, geschlecht, tarif, konto_privat, geburtsdatum)
  values (
    new.id,
    new.raw_user_meta_data->>'vorname',
    new.raw_user_meta_data->>'nachname',
    new.raw_user_meta_data->>'handle',
    new.raw_user_meta_data->>'gender',
    'free',
    coalesce((new.raw_user_meta_data->>'privat')::boolean, false),
    v_geb
  )
  on conflict (id) do nothing;
  if datum_unter_16(v_geb) then
    insert into public.eltern_zustimmungen (kind_id, herkunft, eltern_email, loeschen_ab, konto_gesperrt)
    values (new.id, 'registrierung', v_eltern, now() + interval '14 days', true);
    -- Login sperren; Eltern-Adresse nicht zusaetzlich in den Kontodaten speichern
    update auth.users set banned_until = public.kinderkonto_sperre(), raw_user_meta_data = raw_user_meta_data - 'eltern_email'
    where id = new.id;
  end if;
  return new;
end;
$function$;

-- Geburtsdatum einmalig nachtragen: unter 16 nur zusammen mit der Eltern-Adresse (Konto wird dann gesperrt)
drop function public.geburtsdatum_setzen(date);
create or replace function public.geburtsdatum_setzen(p_datum date, p_eltern_email text default null)
 returns text
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet.' using errcode = '42501'; end if;
  if p_datum is null or p_datum > (now() at time zone 'Europe/Berlin')::date or p_datum < date '1900-01-01' then
    raise exception 'Bitte gib ein gültiges Geburtsdatum ein.' using errcode = 'P0001';
  end if;
  if (select geburtsdatum from profiles where id = auth.uid()) is not null then
    raise exception 'Dein Geburtsdatum ist bereits eingetragen. Änderungen nur über den TanzRaum-Support.' using errcode = 'P0001';
  end if;
  if datum_unter_16(p_datum) and not exists (select 1 from profiles p where p.id = auth.uid() and p.ist_plattform_admin)
     and nullif(btrim(coalesce(p_eltern_email, '')), '') is null then
    return 'eltern_noetig';
  end if;
  perform set_config('tanzraum.geburtsdatum_setzen', '1', true);
  update profiles set geburtsdatum = p_datum where id = auth.uid();
  if mein_kinderkonto_status() = 'zustimmung_noetig' then
    perform eltern_zustimmung_anfordern(p_eltern_email);
    return 'wartet';
  end if;
  return 'ok';
end;
$function$;

-- Geburtsdatum nur ueber geburtsdatum_setzen (sonst liesse sich der Elternschritt umgehen)
create or replace function public.profiles_schuetzen()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  -- Tarif-Neuberechnung (tarif_neu_berechnen_*) darf den Tarif setzen; alles andere nur TanzRaum
  if not ist_endnutzer() or exists (select 1 from tarif_system_freigabe t where t.txid = txid_current()) then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.ist_plattform_admin := false;
    new.tarif := 'free';
    new.tarif_aktiv_bis := null;
    new.gesperrt := false;
    new.stripe_customer_id := null;
    new.stripe_subscription_id := null;
    new.paypal_subscription_id := null;
    return new;
  end if;
  if new.ist_plattform_admin is distinct from old.ist_plattform_admin
     or new.tarif is distinct from old.tarif
     or new.tarif_aktiv_bis is distinct from old.tarif_aktiv_bis
     or new.gesperrt is distinct from old.gesperrt
     or new.stripe_customer_id is distinct from old.stripe_customer_id
     or new.stripe_subscription_id is distinct from old.stripe_subscription_id
     or new.paypal_subscription_id is distinct from old.paypal_subscription_id then
    raise exception 'Tarif, Admin-Status, Sperre und Zahlungsdaten koennen nur von TanzRaum geaendert werden.'
      using errcode = '42501';
  end if;
  -- Geburtsdatum: einmal ueber geburtsdatum_setzen eintragen, danach nur durch TanzRaum aenderbar (Jugendschutz)
  if new.geburtsdatum is distinct from old.geburtsdatum
     and (old.geburtsdatum is not null or coalesce(current_setting('tanzraum.geburtsdatum_setzen', true), '') <> '1') then
    raise exception 'Das Geburtsdatum kann nur von TanzRaum geändert werden.' using errcode = '42501';
  end if;
  return new;
end;
$function$;

-- ---------------------------------------------------------------------------------------------
-- 4) Schutzvoreinstellungen unter 16 (Karte aus, Spotlights nur Verein/Kontakte, Push nur mit Einwilligung)
-- ---------------------------------------------------------------------------------------------
alter table public.kind_einstellungen add column push_erlaubt boolean;
alter table public.kind_einstellungen alter column map_erlaubt set default false;
alter table public.kind_einstellungen alter column spotlights_nur_kontakte set default true;
comment on column public.kind_einstellungen.push_erlaubt is 'null = Einwilligung aus der Elternzustimmung (umfang.push)';

-- Push-Benachrichtigungen beruhen auf Einwilligung: unter 16 nur, wenn die Eltern eingewilligt haben
create or replace function public.push_erlaubt(p_user uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select not ist_unter_16(p_user)
      or coalesce((select ke.push_erlaubt from kind_einstellungen ke where ke.kind_id = p_user),
                  (select (z.umfang ->> 'push')::boolean from eltern_zustimmungen z
                   where z.kind_id = p_user and z.status = 'zugestimmt' order by z.entschieden_am desc limit 1),
                  false);
$function$;

create policy "Push-Abos unter 16 nur mit Einwilligung der Eltern" on public.push_subscriptions
  as restrictive for insert to authenticated with check (push_erlaubt(auth.uid()));
create policy "Push-Abos unter 16 nur mit Einwilligung der Eltern (Aendern)" on public.push_subscriptions
  as restrictive for update to authenticated with check (push_erlaubt(auth.uid()));

create or replace function public.ist_auf_map(p_user_id uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  -- Unter 16 nur, wenn ein verknuepftes Elternteil die Map ausdruecklich erlaubt hat (Standard: aus)
  select exists (
    select 1 from profiles p
    where p.id = p_user_id and p.map_sichtbar and p.map_lat is not null
      and not coalesce(p.gesperrt, false) and not coalesce(p.konto_privat, false)
      and not (ist_unter_16(p.id)
               and not (hat_eltern(p.id)
                        and coalesce((select ke.map_erlaubt from kind_einstellungen ke where ke.kind_id = p.id), false))));
$function$;

create or replace function public.spotlight_nur_kontakte(p_id uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  -- Unter 16: nur Verein/Kontakte, bis ein verknuepftes Elternteil das ausdruecklich aendert
  select s.sichtbarkeit = 'kontakte' or coalesce(a.konto_privat, false)
      or (ist_unter_16(s.user_id)
          and (not hat_eltern(s.user_id)
               or coalesce((select ke.spotlights_nur_kontakte from kind_einstellungen ke where ke.kind_id = s.user_id), true)))
  from spotlights s join profiles a on a.id = s.user_id where s.id = p_id;
$function$;

create or replace function public.spotlight_erstellen(p_media_path text, p_media_typ text, p_text text, p_hintergrund text, p_sticker text, p_sichtbarkeit text)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_id uuid;
  v_text text := nullif(btrim(coalesce(p_text, '')), '');
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet.' using errcode = '42501'; end if;
  -- PAUSE: Spotlights sind derzeit ausgeschaltet
  raise exception 'Spotlights sind derzeit nicht verfügbar.' using errcode = 'P0001';
  -- Spotlights nur als Foto
  if p_media_typ <> 'foto' then
    raise exception 'Spotlights gibt es nur als Foto.' using errcode = 'P0001';
  end if;
  if not konto_aktiv() then raise exception 'Dein Konto ist gesperrt.' using errcode = '42501'; end if;
  -- Free: Spotlights nur ansehen
  if tarif_von(auth.uid()) not in ('basic', 'verein') then
    raise exception 'Spotlights erstellen gibt es ab dem Basic-Tarif oder über einen Verein mit Vereinslizenz. Ansehen kannst du sie auch mit Free.' using errcode = 'P0001';
  end if;
  if p_media_typ not in ('foto', 'video', 'text') or p_sichtbarkeit not in ('netzwerk', 'kontakte') then
    raise exception 'Ungültiges Spotlight.' using errcode = 'P0001';
  end if;
  -- Unter 16: oeffentliche Sichtbarkeit serverseitig ausgeschlossen, solange die Eltern sie nicht erlaubt haben
  if ist_unter_16(auth.uid())
     and (not hat_eltern(auth.uid())
          or coalesce((select ke.spotlights_nur_kontakte from kind_einstellungen ke where ke.kind_id = auth.uid()), true)) then
    p_sichtbarkeit := 'kontakte';
  end if;
  if char_length(v_text) > 500 then raise exception 'Der Text darf höchstens 500 Zeichen haben.' using errcode = 'P0001'; end if;
  if p_media_typ = 'text' then
    if v_text is null and p_sticker is null then raise exception 'Schreib etwas oder wähle einen TanzRaum-Smiley.' using errcode = 'P0001'; end if;
    p_media_path := null;
  elsif coalesce(p_media_path, '') not like auth.uid()::text || '/%'
     or not exists (select 1 from storage.objects o where o.bucket_id = 'spotlights' and o.name = p_media_path) then
    raise exception 'Die Datei wurde nicht gefunden. Bitte lade sie erneut hoch.' using errcode = 'P0001';
  end if;
  if p_hintergrund is not null and p_hintergrund not in ('rot', 'gold', 'navy', 'lila', 'gruen', 'rosa') then p_hintergrund := 'rot'; end if;
  if (select count(*) from spotlights s where s.user_id = auth.uid() and s.erstellt_am > now() - interval '1 day') >= 30 then
    raise exception 'Du hast heute schon 30 Spotlights geteilt – morgen geht es weiter.' using errcode = 'P0001';
  end if;
  insert into spotlights (user_id, media_path, media_typ, text_overlay, hintergrund, sticker, sichtbarkeit, erstellt_am, ablauf_am)
  values (auth.uid(), p_media_path, p_media_typ, v_text, coalesce(p_hintergrund, 'rot'), p_sticker, p_sichtbarkeit, now(), now() + interval '24 hours')
  returning id into v_id;
  return v_id;
end;
$function$;

-- ---------------------------------------------------------------------------------------------
-- 5) Elternfunktionen auf "unter 16" umstellen; Volljaehrigkeit nur fuer Elternteile
-- ---------------------------------------------------------------------------------------------
create or replace function public.eltern_nachrichtensperre(p_kind uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select exists (select 1 from kind_einstellungen ke where ke.kind_id = p_kind and not ke.nachrichten_erlaubt)
     and hat_eltern(p_kind) and ist_unter_16(p_kind);
$function$;

create or replace function public.kind_einstellung_setzen(p_kind uuid, p_feld text, p_wert boolean)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if not ist_elternteil_von(auth.uid(), p_kind) or not ist_unter_16(p_kind) then
    raise exception 'Diese Einstellung kann nur ein verknüpftes Elternteil eines Kindes unter 16 ändern.' using errcode = '42501';
  end if;
  if p_feld not in ('nachrichten_erlaubt', 'map_erlaubt', 'spotlights_nur_kontakte', 'push_erlaubt') or p_wert is null then
    raise exception 'Unbekannte Einstellung.' using errcode = 'P0001';
  end if;
  insert into kind_einstellungen (kind_id) values (p_kind) on conflict (kind_id) do nothing;
  execute format('update kind_einstellungen set %I = $1, geaendert_von = $2, geaendert_am = now() where kind_id = $3', p_feld)
    using p_wert, auth.uid(), p_kind;
end;
$function$;

create or replace function public.eltern_code_erzeugen()
 returns text
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_code text := '';
  v_zeichen text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  i int;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet.' using errcode = '42501'; end if;
  if not ist_unter_16(auth.uid()) then
    raise exception 'Ein Eltern-Code ist nur für Kinderkonten unter 16 Jahren möglich.' using errcode = 'P0001';
  end if;
  for i in 1..8 loop
    v_code := v_code || substr(v_zeichen, 1 + (get_byte(extensions.gen_random_bytes(1), 0) % 32), 1);
  end loop;
  insert into eltern_codes (kind_id, code_hash, laeuft_ab)
  values (auth.uid(), encode(extensions.digest(v_code, 'sha256'), 'hex'), now() + interval '30 minutes')
  on conflict (kind_id) do update set code_hash = excluded.code_hash, laeuft_ab = excluded.laeuft_ab;
  return v_code;
end;
$function$;

create or replace function public.eltern_verknuepfen(p_code text)
 returns text
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_kind uuid;
  v_verein uuid;
  v_name text;
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet.' using errcode = '42501'; end if;
  if not ist_volljaehrig(auth.uid()) then
    raise exception 'Nur volljährige Konten mit eingetragenem Geburtsdatum können sich als Elternteil verknüpfen.' using errcode = 'P0001';
  end if;
  if (select count(*) from eltern_code_versuche v where v.user_id = auth.uid() and v.am > now() - interval '1 hour') >= 10 then
    raise exception 'Zu viele Versuche. Bitte versuche es in einer Stunde erneut.' using errcode = 'P0001';
  end if;
  insert into eltern_code_versuche (user_id) values (auth.uid());
  select c.kind_id into v_kind from eltern_codes c
  where c.code_hash = encode(extensions.digest(v_code, 'sha256'), 'hex') and c.laeuft_ab > now();
  if v_kind is null then
    raise exception 'Der Code ist ungültig oder abgelaufen.' using errcode = 'P0001';
  end if;
  if v_kind = auth.uid() or ist_blockiert(auth.uid(), v_kind) then
    raise exception 'Diese Verknüpfung ist nicht möglich.' using errcode = 'P0001';
  end if;
  delete from eltern_codes where kind_id = v_kind;
  if exists (select 1 from eltern_verknuepfungen ev where ev.eltern_id = auth.uid() and ev.kind_id = v_kind) then
    return (select ev.status from eltern_verknuepfungen ev where ev.eltern_id = auth.uid() and ev.kind_id = v_kind);
  end if;
  -- Ist das Kind in einem Verein, bestaetigt zusaetzlich der Vereinsadmin
  select vm.verein_id into v_verein from vereins_mitglieder vm
  where vm.user_id = v_kind and coalesce(vm.aktiv, true)
    and exists (select 1 from vereins_mitglieder a join rollen r on r.id = a.rolle_id
                where a.verein_id = vm.verein_id and coalesce(a.aktiv, true) and rollen_typ(r.name) = 'admin')
  order by vm.created_at limit 1;
  v_name := coalesce((select a.anzeige from anzeige_namen(array[auth.uid()]) a), 'Ein Elternteil');
  if v_verein is null then
    insert into eltern_verknuepfungen (eltern_id, kind_id, status, bestaetigt_am)
    values (auth.uid(), v_kind, 'bestaetigt', now());
    insert into benachrichtigungen (user_id, typ, text) values (v_kind, 'eltern', v_name || ' ist jetzt als Elternteil mit deinem Konto verknüpft.');
    return 'bestaetigt';
  end if;
  insert into eltern_verknuepfungen (eltern_id, kind_id, status, verein_id) values (auth.uid(), v_kind, 'wartet_verein', v_verein);
  insert into benachrichtigungen (user_id, typ, text)
  select a.user_id, 'eltern', v_name || ' möchte sich als Elternteil mit '
         || coalesce((select x.anzeige from anzeige_namen(array[v_kind]) x), 'einem Mitglied') || ' verknüpfen. Bitte in der Mitgliederverwaltung bestätigen.'
  from vereins_mitglieder a join rollen r on r.id = a.rolle_id
  where a.verein_id = v_verein and coalesce(a.aktiv, true) and rollen_typ(r.name) = 'admin' and a.user_id is not null;
  return 'wartet_verein';
end;
$function$;

create or replace function public.netzwerk_suchen(p_suche text)
 returns table(user_id uuid, anzeige text, handle text, avatar_url text, vereine text, status text)
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  q text := btrim(coalesce(p_suche, ''));
  h text := lower(ltrim(btrim(coalesce(p_suche, '')), '@'));
begin
  if netzwerk_modus() is null or length(q) < 2 then
    return;
  end if;
  return query
  select p.id, (select a.anzeige from anzeige_namen(array[p.id]) a), p.handle, p.avatar_url,
    netzwerk_vereine_text(p.id), netzwerk_status(p.id)
  from profiles p
  where netzwerk_sichtbar(p.id)
    and (
      -- Kinderkonten (unter 16) nur ueber den exakten @Nutzernamen auffindbar (wie im Messenger)
      (not ist_unter_16(p.id) and (p.handle ilike '%' || h || '%' or p.vorname ilike '%' || q || '%'
         or p.nachname ilike '%' || q || '%' or (coalesce(p.vorname, '') || ' ' || coalesce(p.nachname, '')) ilike '%' || q || '%'))
      or lower(p.handle) = h)
  order by (lower(p.handle) = h) desc, p.nachname nulls last, p.vorname
  limit 25;
end;
$function$;

create or replace function public.nutzer_suchen(p_suche text)
 returns table(user_id uuid, anzeige text, handle text, avatar_url text, status text, darf_schreiben boolean)
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  q text := lower(btrim(ltrim(btrim(coalesce(p_suche, '')), '@')));
begin
  if auth.uid() is null or char_length(q) < 3 then return; end if;
  q := replace(replace(replace(q, '\', '\\'), '%', '\%'), '_', '\_');
  return query
  with treffer as (
    select p.id from profiles p
    where p.id <> auth.uid() and not coalesce(p.gesperrt, false)
      and not ist_blockiert(auth.uid(), p.id)
      and (not ist_unter_16(p.id) or hat_vereinsbeziehung(auth.uid(), p.id) or ist_elternteil_von(auth.uid(), p.id))
      and (lower(p.handle) like q || '%'
           or (not coalesce(p.konto_privat, false) and not ist_unter_16(p.id)
               and lower(coalesce(p.vorname, '') || ' ' || coalesce(p.nachname, '')) like '%' || q || '%'))
    limit 15
  )
  select t.id, a.anzeige, a.handle,
    (select p.avatar_url from profiles p where p.id = t.id and (not coalesce(p.konto_privat, false) or kann_privates_profil_sehen(p.id))),
    (select case
              when c.status = 'accepted' then 'verbunden'
              when c.status = 'pending' and c.user_id = auth.uid() then 'angefragt'
              when c.status = 'pending' then 'eingehend'
              when c.status = 'rejected' and c.user_id = auth.uid() then 'abgelehnt'
            end
     from connections c where (c.user_id = auth.uid() and c.connected_to = t.id) or (c.user_id = t.id and c.connected_to = auth.uid()) limit 1),
    darf_direkt_schreiben(t.id)
  from treffer t join anzeige_namen(array(select id from treffer)) a on a.user_id = t.id
  order by a.anzeige;
end;
$function$;

-- Funktionen mit geaenderten Ergebnisspalten (unter_15 -> unter_16, ich_minderjaehrig -> ich_unter_16)
drop function public.kontakt_aufnehmen(uuid);
create function public.kontakt_aufnehmen(p_user_id uuid)
 returns table(ergebnis text, gespraech_id uuid, ich_unter_16 boolean)
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_schluessel text;
  v_id uuid;
  c connections%rowtype;
begin
  if auth.uid() is null or p_user_id is null or p_user_id = auth.uid()
     or not exists (select 1 from profiles p where p.id = p_user_id and not coalesce(p.gesperrt, false))
     or ist_blockiert(auth.uid(), p_user_id) then
    return query select 'nicht_moeglich'::text, null::uuid, ist_unter_16(auth.uid());
    return;
  end if;

  v_schluessel := least(auth.uid(), p_user_id)::text || ':' || greatest(auth.uid(), p_user_id)::text;
  select g.id into v_id from gespraeche g where g.dm_schluessel = v_schluessel;

  if darf_direkt_schreiben(p_user_id) then
    if v_id is null then
      insert into gespraeche (typ, dm_schluessel, erstellt_von) values ('dm', v_schluessel, auth.uid()) returning gespraeche.id into v_id;
      insert into gespraech_teilnehmer (gespraech_id, user_id, last_read_at) values (v_id, auth.uid(), now()), (v_id, p_user_id, now());
    end if;
    return query select 'chat'::text, v_id, ist_unter_16(auth.uid());
    return;
  end if;

  select * into c from connections x
  where (x.user_id = auth.uid() and x.connected_to = p_user_id) or (x.user_id = p_user_id and x.connected_to = auth.uid());
  return query select
    case
      when c.id is null then 'anfrage_noetig'
      when c.status = 'pending' and c.user_id = auth.uid() then 'angefragt'
      when c.status = 'pending' then 'eingehend'
      when c.status = 'rejected' and c.user_id = auth.uid() then 'abgelehnt'
      when c.status = 'rejected' then 'anfrage_noetig'
      else 'nicht_moeglich'
    end,
    v_id,
    ist_unter_16(auth.uid());
end;
$function$;

drop function public.meine_map_einstellungen();
create function public.meine_map_einstellungen()
 returns table(map_sichtbar boolean, ort text, hat_position boolean, unter_16 boolean, eltern_erlauben boolean, wird_angezeigt boolean)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select p.map_sichtbar, p.ort, p.map_lat is not null, ist_unter_16(p.id),
    not ist_unter_16(p.id)
      or (hat_eltern(p.id) and coalesce((select ke.map_erlaubt from kind_einstellungen ke where ke.kind_id = p.id), false)),
    ist_auf_map(p.id)
  from profiles p where p.id = auth.uid();
$function$;

drop function public.meine_kind_einstellungen();
create function public.meine_kind_einstellungen()
 returns table(hat_eltern boolean, unter_16 boolean, nachrichten_erlaubt boolean, map_erlaubt boolean, spotlights_nur_kontakte boolean, push_erlaubt boolean)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select hat_eltern(auth.uid()), ist_unter_16(auth.uid()),
    coalesce(ke.nachrichten_erlaubt, true),
    not ist_unter_16(auth.uid()) or (hat_eltern(auth.uid()) and coalesce(ke.map_erlaubt, false)),
    ist_unter_16(auth.uid()) and (not hat_eltern(auth.uid()) or coalesce(ke.spotlights_nur_kontakte, true)),
    push_erlaubt(auth.uid())
  from (select 1) x left join kind_einstellungen ke on ke.kind_id = auth.uid();
$function$;

drop function public.meine_kinder();
create function public.meine_kinder()
 returns table(kind_id uuid, anzeige text, verknuepfung_id uuid, status text, quelle text, unter_16 boolean,
               nachrichten_erlaubt boolean, map_erlaubt boolean, spotlights_nur_kontakte boolean, push_erlaubt boolean)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  with k as (
    select ev.kind_id as kid, ev.id as vid, ev.status, 'code'::text as quelle from eltern_verknuepfungen ev where ev.eltern_id = auth.uid()
    union
    select distinct kvm.user_id, null::uuid, 'bestaetigt', 'verein'
    from eltern_kind_zuordnung ekz join vereins_mitglieder e on e.id = ekz.eltern_vm_id join vereins_mitglieder kvm on kvm.id = ekz.kind_vm_id
    where e.user_id = auth.uid() and kvm.user_id is not null
      and not exists (select 1 from eltern_verknuepfungen x where x.eltern_id = auth.uid() and x.kind_id = kvm.user_id)
  )
  select k.kid, a.anzeige, k.vid, k.status, k.quelle, ist_unter_16(k.kid),
    coalesce(ke.nachrichten_erlaubt, true), coalesce(ke.map_erlaubt, false), coalesce(ke.spotlights_nur_kontakte, true),
    push_erlaubt(k.kid)
  from k join anzeige_namen(array(select kid from k)) a on a.user_id = k.kid
  left join kind_einstellungen ke on ke.kind_id = k.kid
  order by a.anzeige;
$function$;

-- Reine Umstellung der Kommunikationsschutz-Grenze 15 -> 16 in den uebrigen Funktionen (Logik sonst unveraendert)
do $$
declare
  r record;
begin
  for r in
    select p.oid, pg_get_functiondef(p.oid) as def
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace and p.prokind = 'f'
      and p.proname in ('darf_direkt_schreiben', 'kontaktanfrage_senden', 'netzwerk_anfrage_senden', 'netzwerk_auffindbar',
                        'netzwerk_person', 'netzwerk_suche', 'schreib_sperrgrund', 'chat_kopf', 'anruf_starten')
      and pg_get_functiondef(p.oid) ~ '(ist_unter_15\(|unter 15|ab 15|Minderjaehrigenschutz)'
  loop
    -- Funktionsaufrufe und Kommentare (keine sonstigen Logikaenderungen)
    execute replace(replace(replace(replace(r.def, 'ist_unter_15(', 'ist_unter_16('), 'unter 15', 'unter 16'), 'ab 15', 'ab 16'),
                    'Minderjaehrigenschutz', 'Jugendschutz unter 16');
  end loop;
  if exists (select 1 from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prokind = 'f'
               and p.proname not in ('ist_unter_15', 'ist_minderjaehrig') and pg_get_functiondef(p.oid) ~ '(ist_unter_15|ist_minderjaehrig)\(') then
    raise exception 'Es gibt noch Funktionen mit der alten Altersgrenze 15 bzw. ist_minderjaehrig.';
  end if;
end $$;

drop function public.ist_unter_15(uuid);
drop function public.ist_minderjaehrig(uuid);

-- ---------------------------------------------------------------------------------------------
-- 6) Rechte und Zeitplan
-- ---------------------------------------------------------------------------------------------
revoke all on function public.ist_unter_16(uuid), public.ist_volljaehrig(uuid), public.datum_unter_16(date),
  public.elternzustimmung_vorhanden(uuid), public.kinderkonto_login_sperren(uuid), public.kinderkonto_login_freigeben(uuid),
  public.kinderkonto_mail_unterdruecken(uuid, text), public.kinderkonten_aufraeumen(), public.kinderkonto_sperre_halten(),
  public.push_erlaubt(uuid), public.kinderkonto_sperre(), public.zustimmung_textversion()
  from public, anon, authenticated;
grant execute on function public.ist_unter_16(uuid), public.ist_volljaehrig(uuid), public.datum_unter_16(date),
  public.elternzustimmung_vorhanden(uuid), public.push_erlaubt(uuid), public.kinderkonto_sperre()
  to authenticated, service_role;
grant execute on function public.zustimmung_textversion() to anon, authenticated, service_role;
grant execute on function public.kinderkonto_login_sperren(uuid), public.kinderkonto_login_freigeben(uuid),
  public.kinderkonto_mail_unterdruecken(uuid, text), public.kinderkonten_aufraeumen() to service_role;

revoke all on function public.mein_kinderkonto_status(), public.eltern_zustimmung_anfordern(text),
  public.eltern_verknuepfen_mit_zustimmung(text), public.geburtsdatum_setzen(date, text),
  public.kontakt_aufnehmen(uuid), public.meine_map_einstellungen(), public.meine_kind_einstellungen(), public.meine_kinder()
  from public, anon;
grant execute on function public.mein_kinderkonto_status(), public.eltern_zustimmung_anfordern(text),
  public.eltern_verknuepfen_mit_zustimmung(text), public.geburtsdatum_setzen(date, text),
  public.kontakt_aufnehmen(uuid), public.meine_map_einstellungen(), public.meine_kind_einstellungen(), public.meine_kinder()
  to authenticated, service_role;

-- Zustimmungsseite: ohne TanzRaum-Konto nutzbar (nur mit gueltigem, einmaligem Link)
revoke all on function public.eltern_zustimmung_info(text), public.eltern_zustimmung_entscheiden(text, boolean, boolean, boolean, boolean, text) from public;
grant execute on function public.eltern_zustimmung_info(text), public.eltern_zustimmung_entscheiden(text, boolean, boolean, boolean, boolean, text)
  to anon, authenticated, service_role;

select cron.schedule('kinderkonten-aufraeumen', '40 3 * * *', 'select public.kinderkonten_aufraeumen()');
