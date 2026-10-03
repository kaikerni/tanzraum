-- TanzRaum Masterplan Phase 2a: zentrale Anbieterangaben, versionierte Rechtstexte und Einwilligungen, Push-Kategorien
--
-- 1) plattform_anbieter: eine zentrale Stelle fuer Impressum, Kontakt, Datenschutz-Verantwortlichen und Rechnungen
--    (inkl. Kleinunternehmer-Hinweis). Oeffentlich lesbar nur ueber plattform_anbieter_oeffentlich() (ohne Steuernummer).
-- 2) rechtstext_versionen: Register der veroeffentlichten Fassungen (Nutzungsbedingungen, Datenschutz, Elternzustimmung).
-- 3) einwilligungen: append-only Nachweis WER hat WANN welcher Version WELCHER Einwilligung zugestimmt/widersprochen.
--    Erfasst bei Registrierung, Push (Geraet an/aus), TanzRaum Map, Elternzustimmung und Eltern-Einstellungen.
-- 4) push_einstellungen: Push-Kategorien je Nutzer; Chat- und Anruf-Push beruecksichtigen sie.

-- ---------------------------------------------------------------------------------------------
-- 1) Zentrale Anbieterangaben
-- ---------------------------------------------------------------------------------------------
create table public.plattform_anbieter (
  id boolean primary key default true check (id),
  name text not null,
  unternehmen text,
  strasse text not null,
  plz text not null,
  ort text not null,
  land text not null default 'Deutschland',
  telefon text,
  email text not null,
  verantwortlich_inhalt text,
  kleinunternehmer boolean not null default false,
  kleinunternehmer_hinweis text not null default 'Gemäß § 19 UStG wird keine Umsatzsteuer berechnet (Kleinunternehmerregelung).',
  ust_id text,
  steuernummer text,
  geaendert_am timestamptz not null default now(),
  geaendert_von uuid
);
comment on table public.plattform_anbieter is 'Zentrale Anbieter-/Betreiberangaben (Impressum, Kontakt, Datenschutz, Rechnungen). Genau eine Zeile.';
comment on column public.plattform_anbieter.steuernummer is 'Nur fuer Rechnungen; nicht oeffentlich.';

-- Startwerte aus den bisherigen Angaben (Impressum/Rechnungseinstellungen)
insert into public.plattform_anbieter (name, unternehmen, strasse, plz, ort, telefon, email, verantwortlich_inhalt, kleinunternehmer, steuernummer)
select 'Kai Kern', 'Taktmanufaktur', 'Jahnstraße 15', '67378', 'Zeiskam', '0176 55101261', 'info@tanzraum.app',
       'Kai Kern, Jahnstraße 15, 67378 Zeiskam', true, (select r.steuernummer from public.rechnungs_einstellungen r where r.id)
on conflict do nothing;

comment on column public.rechnungs_einstellungen.firmenzeile is 'Veraltet: Rechnungssteller kommt aus plattform_anbieter.';
comment on column public.rechnungs_einstellungen.adresse is 'Veraltet: Rechnungssteller kommt aus plattform_anbieter.';
comment on column public.rechnungs_einstellungen.steuernummer is 'Veraltet: Steuernummer kommt aus plattform_anbieter.';

create or replace function public.plattform_anbieter_pruefen()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  new.name := btrim(new.name);
  new.strasse := btrim(new.strasse);
  new.plz := btrim(new.plz);
  new.ort := btrim(new.ort);
  new.email := lower(btrim(new.email));
  new.unternehmen := nullif(btrim(coalesce(new.unternehmen, '')), '');
  new.telefon := nullif(btrim(coalesce(new.telefon, '')), '');
  new.verantwortlich_inhalt := nullif(btrim(coalesce(new.verantwortlich_inhalt, '')), '');
  new.ust_id := nullif(btrim(coalesce(new.ust_id, '')), '');
  new.steuernummer := nullif(btrim(coalesce(new.steuernummer, '')), '');
  new.kleinunternehmer_hinweis := btrim(new.kleinunternehmer_hinweis);
  if new.name = '' or new.strasse = '' or new.plz = '' or new.ort = '' then
    raise exception 'Name und vollständige Anschrift sind Pflicht.' using errcode = 'P0001';
  end if;
  if new.email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Bitte eine gültige E-Mail-Adresse angeben.' using errcode = 'P0001';
  end if;
  if new.kleinunternehmer and new.kleinunternehmer_hinweis = '' then
    raise exception 'Bitte den Hinweis zur Kleinunternehmerregelung angeben.' using errcode = 'P0001';
  end if;
  new.geaendert_am := now();
  new.geaendert_von := auth.uid();
  return new;
end;
$function$;
create trigger plattform_anbieter_pruefen before insert or update on public.plattform_anbieter
  for each row execute function public.plattform_anbieter_pruefen();

alter table public.plattform_anbieter enable row level security;
create policy "Plattformadmin liest Anbieterangaben" on public.plattform_anbieter for select to authenticated
  using (ist_plattform_admin_aktuell());
create policy "Plattformadmin pflegt Anbieterangaben" on public.plattform_anbieter for update to authenticated
  using (ist_plattform_admin_aktuell()) with check (ist_plattform_admin_aktuell());
revoke all on table public.plattform_anbieter from public, anon;
grant select, update on table public.plattform_anbieter to authenticated;
grant all on table public.plattform_anbieter to service_role;

-- Oeffentliche Angaben (Impressum, Kontakt, Footer) -- ohne Steuernummer
create or replace function public.plattform_anbieter_oeffentlich()
 returns table(name text, unternehmen text, strasse text, plz text, ort text, land text, telefon text, email text,
               verantwortlich_inhalt text, kleinunternehmer boolean, kleinunternehmer_hinweis text, ust_id text)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select a.name, a.unternehmen, a.strasse, a.plz, a.ort, a.land, a.telefon, a.email, a.verantwortlich_inhalt,
         a.kleinunternehmer, a.kleinunternehmer_hinweis, a.ust_id
  from plattform_anbieter a where a.id;
$function$;
revoke all on function public.plattform_anbieter_oeffentlich() from public;
grant execute on function public.plattform_anbieter_oeffentlich() to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------
-- 2) Rechtstext-Versionen (Register; die Texte selbst liegen versioniert im Code)
-- ---------------------------------------------------------------------------------------------
create table public.rechtstext_versionen (
  art text not null check (art in ('nutzungsbedingungen', 'datenschutz', 'eltern_zustimmung')),
  version text not null check (char_length(version) between 1 and 120),
  gueltig_ab timestamptz not null default now(),
  aenderungshinweis text,
  erfasst_am timestamptz not null default now(),
  primary key (art, version)
);
insert into public.rechtstext_versionen (art, version, gueltig_ab, aenderungshinweis) values
  ('nutzungsbedingungen', '26.09.2026', '2026-09-26', 'Erste veröffentlichte Fassung (inkl. Widerrufsbelehrung)'),
  ('datenschutz', '26.09.2026', '2026-09-26', 'Erste veröffentlichte Fassung'),
  ('eltern_zustimmung', 'eltern-zustimmung-v1', '2026-09-26', 'Zustimmung eines Elternteils für Kinderkonten unter 16');
alter table public.rechtstext_versionen enable row level security;
create policy "Alle lesen Rechtstext-Versionen" on public.rechtstext_versionen for select to anon, authenticated using (true);
revoke all on table public.rechtstext_versionen from public;
grant select on table public.rechtstext_versionen to anon, authenticated;
grant all on table public.rechtstext_versionen to service_role;

create or replace function public.rechtstext_aktuell(p_art text)
 returns text
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select v.version from rechtstext_versionen v where v.art = p_art and v.gueltig_ab <= now()
  order by v.gueltig_ab desc, v.erfasst_am desc limit 1;
$function$;
revoke all on function public.rechtstext_aktuell(text) from public;
grant execute on function public.rechtstext_aktuell(text) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------
-- 3) Einwilligungen (append-only)
-- ---------------------------------------------------------------------------------------------
create table public.einwilligungen (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  art text not null check (art in ('nutzungsbedingungen', 'datenschutz_kenntnis', 'eltern_zustimmung', 'push', 'map')),
  version text not null,
  erteilt boolean not null,
  quelle text not null check (quelle in ('registrierung', 'einstellungen', 'geraet', 'eltern_link', 'eltern_einstellung')),
  erteilt_von uuid,
  details jsonb not null default '{}'::jsonb,
  zeitpunkt timestamptz not null default now()
);
comment on table public.einwilligungen is 'Nachweis von Einwilligungen/Kenntnisnahmen (append-only). erteilt=false = Widerruf/Ablehnung.';
create index einwilligungen_user_idx on public.einwilligungen (user_id, art, zeitpunkt desc);

create or replace function public.einwilligungen_unveraenderlich()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $function$
begin
  raise exception 'Einwilligungsnachweise können nicht geändert werden.' using errcode = '42501';
end;
$function$;
create trigger einwilligungen_unveraenderlich before update on public.einwilligungen
  for each row execute function public.einwilligungen_unveraenderlich();

alter table public.einwilligungen enable row level security;
create policy "Eigene Einwilligungen sehen" on public.einwilligungen for select to authenticated
  using (user_id = auth.uid() or ist_plattform_admin_aktuell());
revoke all on table public.einwilligungen from public, anon;
grant select on table public.einwilligungen to authenticated;
grant all on table public.einwilligungen to service_role;

-- interner Helfer (nur aus Triggern/Definer-Funktionen)
create or replace function public.einwilligung_eintragen(p_user uuid, p_art text, p_version text, p_erteilt boolean,
                                                         p_quelle text, p_details jsonb default '{}'::jsonb)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  insert into einwilligungen (user_id, art, version, erteilt, quelle, erteilt_von, details)
  values (p_user, p_art, p_version, p_erteilt, p_quelle, auth.uid(), coalesce(p_details, '{}'::jsonb));
end;
$function$;
revoke all on function public.einwilligung_eintragen(uuid, text, text, boolean, text, jsonb) from public, anon, authenticated;

-- Registrierung: Nutzungsbedingungen akzeptiert + Datenschutzerklaerung zur Kenntnis genommen.
-- Das Formular uebergibt die angezeigten Versionen in den Metadaten; sie muessen den aktuellen entsprechen.
create or replace function public.einwilligungen_bei_registrierung()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_nb text := new.raw_user_meta_data->>'nutzungsbedingungen_version';
  v_ds text := new.raw_user_meta_data->>'datenschutz_version';
begin
  if v_nb is null and v_ds is null then
    return new; -- z. B. vom Verein angelegte Konten oder Einladungen ohne Formular
  end if;
  if v_nb is distinct from rechtstext_aktuell('nutzungsbedingungen') or v_ds is distinct from rechtstext_aktuell('datenschutz') then
    raise exception 'Die Nutzungsbedingungen oder die Datenschutzerklärung wurden aktualisiert. Bitte lade die Seite neu.' using errcode = 'P0001';
  end if;
  insert into einwilligungen (user_id, art, version, erteilt, quelle, erteilt_von)
  values (new.id, 'nutzungsbedingungen', v_nb, true, 'registrierung', new.id),
         (new.id, 'datenschutz_kenntnis', v_ds, true, 'registrierung', new.id);
  return new;
end;
$function$;
create trigger einwilligungen_bei_registrierung after insert on auth.users
  for each row execute function public.einwilligungen_bei_registrierung();

-- Bestandskonten bzw. neue Fassung der Nutzungsbedingungen: Zustimmung in der App nachholen
create or replace function public.rechtstexte_offen()
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select auth.uid() is not null and not exists (
    select 1 from einwilligungen e
    where e.user_id = auth.uid() and e.art = 'nutzungsbedingungen' and e.erteilt
      and e.version = rechtstext_aktuell('nutzungsbedingungen'));
$function$;

create or replace function public.rechtstexte_bestaetigen(p_nutzungsbedingungen text, p_datenschutz text)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet.' using errcode = '42501'; end if;
  if p_nutzungsbedingungen is distinct from rechtstext_aktuell('nutzungsbedingungen')
     or p_datenschutz is distinct from rechtstext_aktuell('datenschutz') then
    raise exception 'Die Texte wurden aktualisiert. Bitte lade die Seite neu.' using errcode = 'P0001';
  end if;
  perform einwilligung_eintragen(auth.uid(), 'nutzungsbedingungen', p_nutzungsbedingungen, true, 'einstellungen');
  if not exists (select 1 from einwilligungen e where e.user_id = auth.uid() and e.art = 'datenschutz_kenntnis' and e.version = p_datenschutz) then
    perform einwilligung_eintragen(auth.uid(), 'datenschutz_kenntnis', p_datenschutz, true, 'einstellungen');
  end if;
end;
$function$;
revoke all on function public.rechtstexte_offen(), public.rechtstexte_bestaetigen(text, text) from public, anon;
grant execute on function public.rechtstexte_offen(), public.rechtstexte_bestaetigen(text, text) to authenticated;

-- Push: Geraet angemeldet / abgemeldet (nur durch die Person selbst; Aufraeumen abgelaufener Geraete zaehlt nicht)
create or replace function public.einwilligung_push_geraet()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_zuletzt boolean;
begin
  -- nur Zustandswechsel protokollieren (kein Eintrag bei erneutem Anmelden desselben Geraets)
  select e.erteilt into v_zuletzt from einwilligungen e
  where e.user_id = coalesce(new.user_id, old.user_id) and e.art = 'push' order by e.zeitpunkt desc limit 1;
  if tg_op = 'INSERT' and auth.uid() = new.user_id and v_zuletzt is not true then
    perform einwilligung_eintragen(new.user_id, 'push', 'push-v1', true, 'geraet');
  elsif tg_op = 'DELETE' and auth.uid() = old.user_id and v_zuletzt is true
        and not exists (select 1 from push_subscriptions ps where ps.user_id = old.user_id and ps.id <> old.id) then
    perform einwilligung_eintragen(old.user_id, 'push', 'push-v1', false, 'geraet');
  end if;
  return null;
end;
$function$;
create trigger einwilligung_push_geraet after insert or delete on public.push_subscriptions
  for each row execute function public.einwilligung_push_geraet();

-- TanzRaum Map: Sichtbarkeit an/aus
create or replace function public.einwilligung_map()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if new.map_sichtbar is distinct from old.map_sichtbar and auth.uid() = new.id then
    perform einwilligung_eintragen(new.id, 'map', 'map-v1', coalesce(new.map_sichtbar, false), 'einstellungen');
  end if;
  return null;
end;
$function$;
create trigger einwilligung_map after update of map_sichtbar on public.profiles
  for each row execute function public.einwilligung_map();

-- Eltern-Einstellungen fuer Kinder unter 16 (Push, Map)
create or replace function public.einwilligung_kind_einstellung()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if auth.uid() is null then return null; end if;
  if new.push_erlaubt is distinct from (case when tg_op = 'UPDATE' then old.push_erlaubt end) and (tg_op = 'UPDATE' or new.push_erlaubt) then
    perform einwilligung_eintragen(new.kind_id, 'push', 'push-v1', coalesce(new.push_erlaubt, false), 'eltern_einstellung');
  end if;
  if new.map_erlaubt is distinct from (case when tg_op = 'UPDATE' then old.map_erlaubt end) and (tg_op = 'UPDATE' or new.map_erlaubt) then
    perform einwilligung_eintragen(new.kind_id, 'map', 'map-v1', coalesce(new.map_erlaubt, false), 'eltern_einstellung');
  end if;
  return null;
end;
$function$;
create trigger einwilligung_kind_einstellung after insert or update of push_erlaubt, map_erlaubt on public.kind_einstellungen
  for each row execute function public.einwilligung_kind_einstellung();

-- Elternzustimmung ueber den Link (ohne Konto) ebenfalls im Nachweis
create or replace function public.einwilligung_eltern_zustimmung()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if new.status is distinct from old.status and new.status in ('zugestimmt', 'abgelehnt') then
    insert into einwilligungen (user_id, art, version, erteilt, quelle, erteilt_von, details)
    values (new.kind_id, 'eltern_zustimmung', coalesce(new.textversion, zustimmung_textversion()), new.status = 'zugestimmt', 'eltern_link',
            new.eltern_id, jsonb_build_object('zustimmung_id', new.id));
    if new.status = 'zugestimmt' then
      insert into einwilligungen (user_id, art, version, erteilt, quelle, erteilt_von, details)
      values (new.kind_id, 'push', 'push-v1', coalesce((new.umfang->>'push')::boolean, false), 'eltern_link', new.eltern_id,
              jsonb_build_object('zustimmung_id', new.id));
    end if;
  end if;
  return null;
end;
$function$;
create trigger einwilligung_eltern_zustimmung after update of status on public.eltern_zustimmungen
  for each row execute function public.einwilligung_eltern_zustimmung();

revoke all on function public.einwilligungen_unveraenderlich(), public.einwilligungen_bei_registrierung(),
  public.einwilligung_push_geraet(), public.einwilligung_map(), public.einwilligung_kind_einstellung(),
  public.einwilligung_eltern_zustimmung(), public.plattform_anbieter_pruefen() from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- 4) Push-Kategorien
-- ---------------------------------------------------------------------------------------------
create table public.push_einstellungen (
  user_id uuid not null references auth.users(id) on delete cascade,
  kategorie text not null check (kategorie in ('chat', 'anrufe', 'training', 'trainingsaenderung', 'abmeldung', 'news', 'wichtige_news', 'turniere')),
  aktiv boolean not null,
  geaendert_am timestamptz not null default now(),
  primary key (user_id, kategorie)
);
alter table public.push_einstellungen enable row level security;
create policy "Eigene Push-Einstellungen" on public.push_einstellungen for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke all on table public.push_einstellungen from public, anon;
grant select, insert, update, delete on table public.push_einstellungen to authenticated;
grant all on table public.push_einstellungen to service_role;

-- Voreinstellung: nicht jede Benachrichtigung ist automatisch aktiv
create or replace function public.push_kategorie_standard(p_kategorie text)
 returns boolean
 language sql
 immutable
as $function$
  select p_kategorie in ('chat', 'anrufe', 'trainingsaenderung', 'wichtige_news');
$function$;

create or replace function public.push_kategorie_aktiv(p_user uuid, p_kategorie text)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select coalesce((select e.aktiv from push_einstellungen e where e.user_id = p_user and e.kategorie = p_kategorie),
                  push_kategorie_standard(p_kategorie));
$function$;
revoke all on function public.push_kategorie_aktiv(uuid, text) from public, anon, authenticated;
grant execute on function public.push_kategorie_standard(text) to authenticated, service_role;

create or replace function public.meine_push_einstellungen()
 returns table(kategorie text, aktiv boolean)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select k, push_kategorie_aktiv(auth.uid(), k)
  from unnest(array['chat', 'anrufe', 'training', 'trainingsaenderung', 'abmeldung', 'news', 'wichtige_news', 'turniere']) k
  where auth.uid() is not null;
$function$;
revoke all on function public.meine_push_einstellungen() from public, anon;
grant execute on function public.meine_push_einstellungen() to authenticated;

-- Chat-Push: Kategorie "chat" beachten
CREATE OR REPLACE FUNCTION public.chat_push_ziele(p_geheimnis text, p_nachricht_id uuid)
 RETURNS TABLE(abo_id uuid, endpoint text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  n nachrichten%rowtype;
  g gespraeche%rowtype;
  kandidat uuid;
  empfaenger uuid[] := '{}';
begin
  if p_geheimnis is null or p_geheimnis <> (select decrypted_secret from vault.decrypted_secrets where name = 'chat_push_geheimnis') then
    raise exception 'Nicht berechtigt' using errcode = '42501';
  end if;
  select * into n from nachrichten where id = p_nachricht_id;
  if n.id is null or n.geloescht_am is not null then return; end if;
  select * into g from gespraeche where id = n.gespraech_id;
  if g.typ = 'juryraum' then return; end if;

  for kandidat in
    select distinct u from (
      select t.user_id as u from gespraech_teilnehmer t where t.gespraech_id = g.id
      union
      select vm.user_id from vereins_mitglieder vm where g.verein_id is not null and vm.verein_id = g.verein_id and coalesce(vm.aktiv, true)
    ) x
    where u is not null and u <> n.sender_id
      and exists (select 1 from push_subscriptions ps where ps.user_id = x.u)
      and push_kategorie_aktiv(x.u, 'chat')
      and not exists (select 1 from blockierungen b where b.blocker_id = x.u and b.blockiert_id = n.sender_id)
      and (g.nur_leitung_schreibt or not exists (select 1 from chat_stumm s where s.gespraech_id = g.id and s.user_id = x.u))
  loop
    perform set_config('request.jwt.claim.sub', kandidat::text, true);
    perform set_config('request.jwt.claims', json_build_object('sub', kandidat, 'role', 'authenticated')::text, true);
    if hat_gespraech_zugriff(g.id) then
      empfaenger := empfaenger || kandidat;
    end if;
  end loop;

  return query select ps.id, ps.endpoint from push_subscriptions ps where ps.user_id = any(empfaenger);
end;
$function$;

-- Anruf-Push: Kategorie "anrufe" beachten
CREATE OR REPLACE FUNCTION public.anruf_push_ziele(p_geheimnis text, p_anruf_id uuid)
 RETURNS TABLE(abo_id uuid, endpoint text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if p_geheimnis is null or p_geheimnis <> (select decrypted_secret from vault.decrypted_secrets where name = 'chat_push_geheimnis') then
    raise exception 'Nicht berechtigt' using errcode = '42501';
  end if;
  return query
  select ps.id, ps.endpoint from anrufe a join push_subscriptions ps on ps.user_id = a.angerufener_id
  where a.id = p_anruf_id and a.status = 'klingelt' and push_kategorie_aktiv(a.angerufener_id, 'anrufe');
end;
$function$;
