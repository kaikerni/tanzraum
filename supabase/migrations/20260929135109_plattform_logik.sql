-- Plattform-Logik: Lizenzregeln, freiwillige Vereinsangabe, konfigurierbare Vereinsbereiche, Online-Status,
-- aggregierte Admin-Statistiken ohne Personendaten, Kennzeichnung "TanzRaum Admin" im Chat,
-- weitere Antragsverfahren, abgesicherte Fernwartung fuer Vereine.

-- ---------------------------------------------------------------------------------------------
-- 1. Offizielle Vereinszuordnung nur in Vereinen mit aktiver Verein-Lizenz
--    (Ausnahme: die erste Person = Vereinsadmin bei der Vereinsregistrierung, damit der Verein
--     angelegt und die Lizenz abgeschlossen werden kann)
-- ---------------------------------------------------------------------------------------------
create or replace function public.pruefe_vereinslizenz_zuordnung()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if not verein_hat_lizenz(new.verein_id)
     and exists (select 1 from vereins_mitglieder vm where vm.verein_id = new.verein_id and vm.id <> new.id) then
    raise exception 'Offizielle Vereinszuordnungen sind nur in Vereinen mit aktiver Verein-Lizenz möglich.' using errcode = 'P0001';
  end if;
  return new;
end;
$function$;
drop trigger if exists vereins_mitglieder_lizenz on public.vereins_mitglieder;
create trigger vereins_mitglieder_lizenz before insert on public.vereins_mitglieder
  for each row execute function public.pruefe_vereinslizenz_zuordnung();

-- ---------------------------------------------------------------------------------------------
-- 2. Profil: freiwillige Angabe "Verein, in dem ich tanze" (keine Vereinszuordnung) und Online-Status
-- ---------------------------------------------------------------------------------------------
alter table public.profiles
  add column if not exists verein_angabe text,
  add column if not exists zuletzt_online timestamptz,
  add column if not exists online_sichtbar boolean not null default false;
alter table public.profiles add constraint profiles_verein_angabe_laenge check (char_length(verein_angabe) <= 100);
comment on column public.profiles.verein_angabe is
  'Freiwillige Profilangabe "Verein, in dem ich tanze" – KEINE offizielle Vereinszuordnung, keine Rechte';
comment on column public.profiles.online_sichtbar is 'Online-Status fuer Kontakte/Vereinsmitglieder mit Namen zeigen (Opt-in)';

-- Profilansicht zeigt die freiwillige Angabe (wie andere Profilangaben nur bei sichtbarem Profil)
do $mig$
declare
  d text := pg_get_functiondef('public.netzwerk_person(uuid)'::regprocedure);
  alt text := $o$'status', verbindungs_status(p.id),$o$;
  neu text := $n$'verein_angabe', case when v_privat_sichtbar then p.verein_angabe end,
    'status', verbindungs_status(p.id),$n$;
begin
  if position(alt in d) = 0 then
    raise exception 'netzwerk_person: erwarteter Ausdruck nicht gefunden';
  end if;
  execute replace(d, alt, neu);
end
$mig$;

-- ---------------------------------------------------------------------------------------------
-- 3. Vereinsbereiche ein-/ausschalten (keine Daten werden geloescht)
-- ---------------------------------------------------------------------------------------------
create or replace function public.vereins_module()
 returns text[]
 language sql
 immutable
 set search_path to 'public'
as $function$
  select array['training', 'anwesenheit', 'kalender', 'saisonplanung', 'turniere', 'news', 'chat', 'dateien',
               'fahrgemeinschaften', 'kostueme', 'finanzen', 'musik', 'statistiken', 'trainer_netzwerk'];
$function$;

alter table public.vereine add column if not exists module_aus text[] not null default '{}';
alter table public.vereine add constraint vereine_module_aus_gueltig check (module_aus <@ vereins_module());
comment on column public.vereine.module_aus is 'Vom Verein ausgeblendete Bereiche (Daten bleiben erhalten)';

-- Ausgeblendete Bereiche des eigenen Vereins
create or replace function public.meine_module_aus()
 returns text[]
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select coalesce((
    select v.module_aus from vereins_mitglieder vm join vereine v on v.id = vm.verein_id
    where vm.user_id = auth.uid() and coalesce(vm.aktiv, true) and vm.aufnahme_status = 'aufgenommen'
    limit 1), '{}'::text[]);
$function$;

-- ---------------------------------------------------------------------------------------------
-- 4. Fernwartung fuer Vereine: zeitlich begrenzt, nur mit Freigabe, protokolliert, widerrufbar,
--    ausschliesslich Konfiguration – niemals Mitgliederdaten
-- ---------------------------------------------------------------------------------------------
create table if not exists public.fernwartung_protokoll (
  id uuid primary key default gen_random_uuid(),
  anfrage_id uuid not null references public.fernwartungs_anfragen(id) on delete cascade,
  verein_id uuid not null references public.vereine(id) on delete cascade,
  admin_id uuid references public.profiles(id) on delete set null,
  aktion text not null check (char_length(aktion) <= 300),
  zeitpunkt timestamptz not null default now()
);
alter table public.fernwartung_protokoll enable row level security;
drop policy if exists "Fernwartungsprotokoll sehen" on public.fernwartung_protokoll;
create policy "Fernwartungsprotokoll sehen" on public.fernwartung_protokoll for select to authenticated
  using (is_verein_admin(verein_id) or ist_plattform_admin_aktuell());
revoke insert, update, delete, truncate on public.fernwartung_protokoll from anon, authenticated;

-- Aktive Fernwartung: Plattform-Admin + Anfrage des Vereins mit Fernzugriff, nicht widerrufen, nicht abgelaufen
create or replace function public.fernwartung_aktiv(p_verein_id uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select ist_plattform_admin_aktuell() and exists (
    select 1 from fernwartungs_anfragen f
    where f.verein_id = p_verein_id and f.fernzugriff_gewuenscht and f.widerrufen_am is null
      and coalesce(f.status, 'offen') in ('offen', 'aktiv') and f.laeuft_ab_am > now());
$function$;

create or replace function public.fernwartung_protokollieren(p_verein_id uuid, p_aktion text)
 returns void
 language sql
 security definer
 set search_path to 'public'
as $function$
  insert into fernwartung_protokoll (anfrage_id, verein_id, admin_id, aktion)
  select f.id, p_verein_id, auth.uid(), left(p_aktion, 300)
  from fernwartungs_anfragen f
  where f.verein_id = p_verein_id and f.fernzugriff_gewuenscht and f.widerrufen_am is null
    and coalesce(f.status, 'offen') in ('offen', 'aktiv') and f.laeuft_ab_am > now()
  order by f.erstellt_am desc limit 1;
$function$;

-- Anfordern nur mit aktiver Verein-Lizenz
do $mig$
declare
  d text := pg_get_functiondef('public.fernwartung_anfordern(uuid,text,text,boolean)'::regprocedure);
  alt text := $o$if not is_verein_admin(p_verein_id) then$o$;
  neu text := $n$if not is_verein_admin(p_verein_id) or not verein_hat_lizenz(p_verein_id) then$n$;
begin
  if position(alt in d) = 0 then
    raise exception 'fernwartung_anfordern: erwarteter Ausdruck nicht gefunden';
  end if;
  execute replace(d, alt, neu);
end
$mig$;

-- Liste fuer die TanzRaum-Administration (nur Anfragen, keine Mitgliederdaten)
create or replace function public.admin_fernwartungen()
 returns table(id uuid, verein_id uuid, verein_name text, typ text, beschreibung text, fernzugriff boolean, code text, status text,
   erstellt_am timestamptz, laeuft_ab_am timestamptz, aktiv boolean)
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
begin
  if not ist_plattform_admin_aktuell() then
    raise exception 'Nur für die TanzRaum-Administration.' using errcode = '42501';
  end if;
  return query
  select f.id, f.verein_id, v.name, f.typ, f.beschreibung, f.fernzugriff_gewuenscht, f.code, coalesce(f.status, 'offen'),
    f.erstellt_am, f.laeuft_ab_am,
    f.fernzugriff_gewuenscht and f.widerrufen_am is null and coalesce(f.status, 'offen') in ('offen', 'aktiv') and f.laeuft_ab_am > now()
  from fernwartungs_anfragen f join vereine v on v.id = f.verein_id
  order by f.erstellt_am desc
  limit 100;
end;
$function$;

-- Konfigurationsdaten eines Vereins fuer die Fernwartung (ohne Personen)
create or replace function public.fernwartung_vereinsdaten(p_verein_id uuid)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
begin
  if not fernwartung_aktiv(p_verein_id) then
    raise exception 'Keine aktive Fernwartung für diesen Verein.' using errcode = '42501';
  end if;
  return (
    select jsonb_build_object(
      'id', v.id, 'name', v.name, 'kuerzel', v.kuerzel, 'beschreibung', v.beschreibung, 'email', v.email, 'telefon', v.telefon,
      'webseite', v.webseite, 'strasse', v.strasse, 'hausnummer', v.hausnummer, 'plz', v.plz, 'ort', v.ort,
      'module_aus', v.module_aus,
      'gruppen', coalesce((select jsonb_agg(jsonb_build_object('name', g.name,
                   'mitglieder', (select count(*) from gruppen_mitglieder gm where gm.gruppe_id = g.id)) order by g.name)
                 from gruppen g where g.verein_id = v.id), '[]'::jsonb),
      'mitglieder_anzahl', (select count(*) from vereins_mitglieder vm where vm.verein_id = v.id),
      'antrag_vorlage', (select jsonb_build_object('inhalt', av.inhalt, 'einstellungen', av.einstellungen) from antrag_vorlagen av where av.verein_id = v.id))
    from vereine v where v.id = p_verein_id);
end;
$function$;

create or replace function public.fernwartung_vereinsdaten_setzen(p_verein_id uuid, p_daten jsonb)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  t text;
begin
  if not fernwartung_aktiv(p_verein_id) then
    raise exception 'Keine aktive Fernwartung für diesen Verein.' using errcode = '42501';
  end if;
  update vereine set
    name = coalesce(nullif(btrim(p_daten ->> 'name'), ''), name),
    kuerzel = case when p_daten ? 'kuerzel' then nullif(btrim(p_daten ->> 'kuerzel'), '') else kuerzel end,
    beschreibung = case when p_daten ? 'beschreibung' then nullif(btrim(p_daten ->> 'beschreibung'), '') else beschreibung end,
    email = case when p_daten ? 'email' then nullif(btrim(p_daten ->> 'email'), '') else email end,
    telefon = case when p_daten ? 'telefon' then nullif(btrim(p_daten ->> 'telefon'), '') else telefon end,
    webseite = case when p_daten ? 'webseite' then nullif(btrim(p_daten ->> 'webseite'), '') else webseite end,
    strasse = case when p_daten ? 'strasse' then nullif(btrim(p_daten ->> 'strasse'), '') else strasse end,
    hausnummer = case when p_daten ? 'hausnummer' then nullif(btrim(p_daten ->> 'hausnummer'), '') else hausnummer end,
    plz = case when p_daten ? 'plz' then nullif(btrim(p_daten ->> 'plz'), '') else plz end,
    ort = case when p_daten ? 'ort' then nullif(btrim(p_daten ->> 'ort'), '') else ort end
  where id = p_verein_id;
  select string_agg(k, ', ') into t from jsonb_object_keys(p_daten) k;
  perform fernwartung_protokollieren(p_verein_id, 'Vereinsdaten geändert: ' || coalesce(t, '–'));
end;
$function$;

-- Bereiche setzen: Vereinsadmin oder aktive Fernwartung
create or replace function public.verein_module_setzen(p_verein_id uuid, p_module_aus text[])
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_fernwartung boolean := fernwartung_aktiv(p_verein_id);
begin
  if not (is_verein_admin(p_verein_id) or v_fernwartung) then
    raise exception 'Die Bereiche des Vereins legt der Vereinsadmin fest.' using errcode = '42501';
  end if;
  if not coalesce(p_module_aus, '{}') <@ vereins_module() then
    raise exception 'Unbekannter Bereich.' using errcode = 'P0001';
  end if;
  update vereine set module_aus = array(select distinct x from unnest(coalesce(p_module_aus, '{}')) x order by x) where id = p_verein_id;
  if v_fernwartung and not is_verein_admin(p_verein_id) then
    perform fernwartung_protokollieren(p_verein_id, 'Bereiche geändert, ausgeblendet: ' || coalesce(array_to_string(p_module_aus, ', '), '–'));
  end if;
end;
$function$;

-- Antragsformular darf auch waehrend einer Fernwartung konfiguriert werden (nicht die Antraege selbst)
drop policy if exists "Antragsvorlage sehen" on public.antrag_vorlagen;
drop policy if exists "Antragsvorlage anlegen" on public.antrag_vorlagen;
drop policy if exists "Antragsvorlage aendern" on public.antrag_vorlagen;
create policy "Antragsvorlage sehen" on public.antrag_vorlagen for select to authenticated
  using (darf_antraege(verein_id) or fernwartung_aktiv(verein_id));
create policy "Antragsvorlage anlegen" on public.antrag_vorlagen for insert to authenticated
  with check (darf_antraege(verein_id) or fernwartung_aktiv(verein_id));
create policy "Antragsvorlage aendern" on public.antrag_vorlagen for update to authenticated
  using (darf_antraege(verein_id) or fernwartung_aktiv(verein_id)) with check (darf_antraege(verein_id) or fernwartung_aktiv(verein_id));

create or replace function public.fernwartung_vorlage_protokoll()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if fernwartung_aktiv(new.verein_id) and not darf_antraege(new.verein_id) then
    perform fernwartung_protokollieren(new.verein_id, 'Mitgliedsantrag-Formular geändert');
  end if;
  return new;
end;
$function$;
drop trigger if exists antrag_vorlagen_fernwartung on public.antrag_vorlagen;
create trigger antrag_vorlagen_fernwartung after insert or update on public.antrag_vorlagen
  for each row execute function public.fernwartung_vorlage_protokoll();

-- ---------------------------------------------------------------------------------------------
-- 5. Online-Status
-- ---------------------------------------------------------------------------------------------
create or replace function public.online_melden()
 returns void
 language sql
 security definer
 set search_path to 'public'
as $function$
  update profiles set zuletzt_online = now()
  where id = auth.uid() and (zuletzt_online is null or zuletzt_online < now() - interval '45 seconds');
$function$;

create or replace function public.online_uebersicht()
 returns jsonb
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  with grenze as (select now() - interval '3 minutes' as t),
  mein_verein as (
    select vm.verein_id from vereins_mitglieder vm
    where vm.user_id = auth.uid() and coalesce(vm.aktiv, true) and vm.aufnahme_status = 'aufgenommen' and verein_hat_lizenz(vm.verein_id)
    limit 1),
  kontakte as (
    select p.id, p.avatar_url, p.konto_privat
    from profiles p, grenze
    where auth.uid() is not null and p.id <> auth.uid() and p.zuletzt_online > grenze.t
      and p.online_sichtbar and not coalesce(p.gesperrt, false) and not ist_unter_16(p.id)
      and not ist_blockiert(auth.uid(), p.id)
      and (netzwerk_verbunden(auth.uid(), p.id) or hat_vereinsbeziehung(auth.uid(), p.id))
    order by p.zuletzt_online desc
    limit 12)
  select case when auth.uid() is null then null else jsonb_build_object(
    'gesamt', (select count(*) from profiles p, grenze where p.zuletzt_online > grenze.t and not coalesce(p.gesperrt, false)),
    'verein', (select count(*) from vereins_mitglieder vm join profiles p on p.id = vm.user_id, grenze
               where vm.verein_id = (select verein_id from mein_verein) and coalesce(vm.aktiv, true)
                 and p.zuletzt_online > grenze.t and vm.user_id <> auth.uid()),
    'hat_verein', exists (select 1 from mein_verein),
    'kontakte', coalesce((select jsonb_agg(jsonb_build_object('id', k.id,
                  'name', (select a.anzeige from anzeige_namen(array[k.id]) a),
                  'avatar_url', case when not coalesce(k.konto_privat, false) or kann_privates_profil_sehen(k.id) then k.avatar_url end))
                from kontakte k), '[]'::jsonb),
    'ich_sichtbar', (select online_sichtbar from profiles where id = auth.uid())) end;
$function$;

create or replace function public.online_sichtbar_setzen(p_sichtbar boolean)
 returns void
 language sql
 security definer
 set search_path to 'public'
as $function$
  update profiles set online_sichtbar = coalesce(p_sichtbar, false) where id = auth.uid();
$function$;

-- ---------------------------------------------------------------------------------------------
-- 6. Aggregierte Statistiken fuer die TanzRaum-Administration (keine Personendaten)
-- ---------------------------------------------------------------------------------------------
create or replace function public.admin_plattform_statistik()
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  v jsonb;
begin
  if not ist_plattform_admin_aktuell() then
    raise exception 'Nur für die TanzRaum-Administration.' using errcode = '42501';
  end if;
  with nutzer as (
    select p.id, p.created_at, p.zuletzt_online, tarif_stufe(p.id) as stufe,
      exists (select 1 from vereins_mitglieder vm where vm.user_id = p.id and coalesce(vm.aktiv, true)
              and vm.aufnahme_status = 'aufgenommen' and verein_hat_lizenz(vm.verein_id)) as zugeordnet
    from profiles p where not coalesce(p.ist_plattform_admin, false)),
  monate as (select generate_series(date_trunc('month', now()) - interval '11 months', date_trunc('month', now()), interval '1 month') as m),
  wochen as (select generate_series(date_trunc('week', now()) - interval '11 weeks', date_trunc('week', now()), interval '1 week') as w)
  select jsonb_build_object(
    'nutzer_gesamt', (select count(*) from nutzer),
    'free', (select count(*) from nutzer where stufe = 'free'),
    'basic', (select count(*) from nutzer where stufe = 'basic'),
    'verein_zugang', (select count(*) from nutzer where stufe = 'verein'),
    'mit_zuordnung', (select count(*) from nutzer where zugeordnet),
    'ohne_zuordnung', (select count(*) from nutzer where not zugeordnet),
    'online_jetzt', (select count(*) from nutzer where zuletzt_online > now() - interval '3 minutes'),
    'aktiv_24h', (select count(*) from nutzer where zuletzt_online > now() - interval '24 hours'),
    'neu_7_tage', (select count(*) from nutzer where created_at > now() - interval '7 days'),
    'neu_30_tage', (select count(*) from nutzer where created_at > now() - interval '30 days'),
    'registrierungen', (select jsonb_agg(jsonb_build_object('monat', to_char(m, 'YYYY-MM'),
                          'neu', (select count(*) from nutzer n where date_trunc('month', n.created_at) = m),
                          'gesamt', (select count(*) from nutzer n where n.created_at < m + interval '1 month')) order by m) from monate),
    'vereine_gesamt', (select count(*) from vereine),
    'lizenzen_aktiv', (select count(*) from vereine x where verein_hat_lizenz(x.id)),
    'lizenzen_inaktiv', (select count(*) from vereine x where not verein_hat_lizenz(x.id)),
    'vereine_verlauf', (select jsonb_agg(jsonb_build_object('monat', to_char(m, 'YYYY-MM'),
                          'gesamt', (select count(*) from vereine x where x.created_at < m + interval '1 month')) order by m) from monate),
    'gruppen_gesamt', (select count(*) from gruppen),
    'nachrichten_wochen', (select jsonb_agg(jsonb_build_object('woche', to_char(w, 'IYYY-IW'),
                          'anzahl', (select count(*) from nachrichten n where date_trunc('week', n.gesendet_am) = w)) order by w) from wochen),
    'nachrichten_30_tage', (select count(*) from nachrichten n where n.gesendet_am > now() - interval '30 days'))
  into v;
  return v;
end;
$function$;

create or replace function public.admin_vereinskarten()
 returns table(verein_id uuid, name text, logo_url text, ort text, lizenz_aktiv boolean, nutzer bigint, gruppen bigint, online bigint,
   module_aus text[], erstellt_am timestamptz)
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
begin
  if not ist_plattform_admin_aktuell() then
    raise exception 'Nur für die TanzRaum-Administration.' using errcode = '42501';
  end if;
  return query
  select v.id, v.name, v.logo_url, v.ort, verein_hat_lizenz(v.id),
    (select count(*) from vereins_mitglieder vm where vm.verein_id = v.id and coalesce(vm.aktiv, true)),
    (select count(*) from gruppen g where g.verein_id = v.id),
    (select count(*) from vereins_mitglieder vm join profiles p on p.id = vm.user_id
     where vm.verein_id = v.id and coalesce(vm.aktiv, true) and p.zuletzt_online > now() - interval '3 minutes'),
    v.module_aus, v.created_at
  from vereine v
  order by verein_hat_lizenz(v.id) desc, v.name;
end;
$function$;

-- Personenbezogene Admin-Abfragen entfernen (TanzRaum-Admin sieht keine Mitgliederdaten; nur noch von der
-- entfernten KI bzw. der bisherigen Mitgliederliste pro Verein genutzt)
drop function if exists public.admin_verein_mitglieder(uuid);
drop function if exists public.admin_offene_beitraege(integer);
drop function if exists public.admin_abmeldungen_heute();
drop function if exists public.admin_personen_uebersicht();
drop function if exists public.admin_update_person(uuid, text, text, text, text, text);

-- ---------------------------------------------------------------------------------------------
-- 7. Chat: TanzRaum-Admin deutlich kennzeichnen (Vereinschats bleiben nur fuer Vereinsmitglieder)
-- ---------------------------------------------------------------------------------------------
do $mig$
declare
  d text := pg_get_functiondef('public.chat_liste()'::regprocedure);
  alt text := $o$case s.typ when 'dm' then null when 'verein' then 'Vereinschat' else v.name end,$o$;
  neu text := $n$case s.typ
      when 'dm' then case when exists (select 1 from profiles ap where ap.id = pt.user_id and coalesce(ap.ist_plattform_admin, false)) then 'TanzRaum Admin' end
      when 'verein' then 'Vereinschat' else v.name end,$n$;
begin
  if (length(d) - length(replace(d, alt, ''))) / length(alt) <> 1 then
    raise exception 'chat_liste: erwarteter Ausdruck nicht genau einmal gefunden';
  end if;
  execute replace(d, alt, neu);
end
$mig$;

-- ---------------------------------------------------------------------------------------------
-- 8. Mitgliedsantrag: bestehende Mitgliedschaft bestaetigen, externes/persoenliches Verfahren
-- ---------------------------------------------------------------------------------------------
alter table public.beitrittsantraege drop constraint if exists beitrittsantraege_verfahren;
alter table public.beitrittsantraege add constraint beitrittsantraege_verfahren
  check (unterschrift_verfahren is null or unterschrift_verfahren in ('bildschirm', 'bestaetigung', 'papier', 'extern', 'bestehend'));

create or replace function public.antrag_einreichen(p_antrag_id uuid, p_daten jsonb, p_verfahren text, p_unterschriften jsonb, p_einreichen boolean default true)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  a beitrittsantraege%rowtype;
  v_erlaubt jsonb;
  v_name text;
begin
  select * into a from beitrittsantraege where id = p_antrag_id for update;
  if not found or not antrag_fuer_mich(a.user_id) then
    raise exception 'Antrag nicht gefunden.' using errcode = '42501';
  end if;
  if a.status <> 'offen' then
    raise exception 'Dieser Antrag wurde bereits eingereicht.' using errcode = 'P0001';
  end if;
  if p_daten is null or jsonb_typeof(p_daten) <> 'object' then
    raise exception 'Ungültige Angaben.' using errcode = 'P0001';
  end if;

  if not p_einreichen then
    update beitrittsantraege set daten = p_daten where id = p_antrag_id;
    return jsonb_build_object('status', 'offen');
  end if;

  if coalesce(btrim(p_daten ->> 'vorname'), '') = '' or coalesce(btrim(p_daten ->> 'nachname'), '') = '' then
    raise exception 'Bitte Vor- und Nachnamen angeben.' using errcode = 'P0001';
  end if;

  if p_verfahren = 'bestehend' then
    -- Bereits Mitglied des Vereins: Bestaetigung statt neuem Beitrittsformular (wenn der Verein das erlaubt)
    if antrag_einstellung(a.verein_id, 'bestehende_bestaetigen', 'true') <> 'true' then
      raise exception 'Der Verein verlangt auch von bestehenden Mitgliedern den Mitgliedsantrag.' using errcode = 'P0001';
    end if;
    if coalesce((p_daten ->> 'bestehend_bestaetigt')::boolean, false) is not true then
      raise exception 'Bitte bestätigen, dass du bereits Mitglied im Verein bist.' using errcode = 'P0001';
    end if;
  else
    select coalesce(av.einstellungen -> 'verfahren', '["bildschirm", "papier"]'::jsonb) into v_erlaubt from antrag_vorlagen av where av.verein_id = a.verein_id;
    v_erlaubt := coalesce(v_erlaubt, '["bildschirm", "papier"]'::jsonb);
    if p_verfahren is null or not (v_erlaubt ? p_verfahren) then
      raise exception 'Dieses Verfahren ist für den Verein nicht freigegeben.' using errcode = 'P0001';
    end if;
    if p_verfahren = 'bildschirm' and coalesce(p_unterschriften -> 'mitglied' ->> 'bild', '') not like 'data:image/png;base64,%' then
      raise exception 'Bitte im Feld „Unterschrift“ unterschreiben.' using errcode = 'P0001';
    end if;
    if p_verfahren = 'bestaetigung' and coalesce(btrim(p_unterschriften -> 'mitglied' ->> 'name'), '') = '' then
      raise exception 'Bitte zur Bestätigung deinen Namen eintragen.' using errcode = 'P0001';
    end if;
  end if;

  update beitrittsantraege set
    daten = p_daten,
    unterschrift_verfahren = p_verfahren,
    unterschriften = case when p_verfahren in ('bildschirm', 'bestaetigung') then coalesce(p_unterschriften, '{}'::jsonb) else '{}'::jsonb end,
    vorlage = jsonb_build_object(
      'inhalt', coalesce((select av.inhalt from antrag_vorlagen av where av.verein_id = a.verein_id), '{}'::jsonb),
      'verein', antrag_vereinsdaten(a.verein_id),
      'stand', now()),
    status = 'eingereicht',
    eingereicht_am = now(),
    eingereicht_von = auth.uid()
  where id = p_antrag_id;

  v_name := btrim(coalesce(p_daten ->> 'vorname', '') || ' ' || coalesce(p_daten ->> 'nachname', ''));
  perform antrag_verwaltung_benachrichtigen(a.verein_id,
    case p_verfahren
      when 'bestehend' then 'Bestehende Mitgliedschaft bestätigt: ' || v_name
      when 'papier' then 'Neuer Mitgliedsantrag: ' || v_name || ' (Unterschrift folgt auf Papier)'
      when 'extern' then 'Neuer Mitgliedsantrag: ' || v_name || ' (Verfahren des Vereins)'
      else 'Neuer Mitgliedsantrag: ' || v_name end);
  return jsonb_build_object('status', 'eingereicht', 'verein_id', a.verein_id);
end;
$function$;

-- ---------------------------------------------------------------------------------------------
-- 9. Rechte
-- ---------------------------------------------------------------------------------------------
revoke execute on function public.pruefe_vereinslizenz_zuordnung() from public, anon, authenticated;
revoke execute on function public.fernwartung_protokollieren(uuid, text) from public, anon, authenticated;
revoke execute on function public.fernwartung_vorlage_protokoll() from public, anon, authenticated;
revoke execute on function public.meine_module_aus() from public, anon;
revoke execute on function public.fernwartung_aktiv(uuid) from public, anon;
revoke execute on function public.admin_fernwartungen() from public, anon;
revoke execute on function public.fernwartung_vereinsdaten(uuid) from public, anon;
revoke execute on function public.fernwartung_vereinsdaten_setzen(uuid, jsonb) from public, anon;
revoke execute on function public.verein_module_setzen(uuid, text[]) from public, anon;
revoke execute on function public.online_melden() from public, anon;
revoke execute on function public.online_uebersicht() from public, anon;
revoke execute on function public.online_sichtbar_setzen(boolean) from public, anon;
revoke execute on function public.admin_plattform_statistik() from public, anon;
revoke execute on function public.admin_vereinskarten() from public, anon;
grant execute on function public.meine_module_aus(), public.fernwartung_aktiv(uuid), public.admin_fernwartungen(),
  public.fernwartung_vereinsdaten(uuid), public.fernwartung_vereinsdaten_setzen(uuid, jsonb), public.verein_module_setzen(uuid, text[]),
  public.online_melden(), public.online_uebersicht(), public.online_sichtbar_setzen(boolean),
  public.admin_plattform_statistik(), public.admin_vereinskarten(), public.vereins_module()
  to authenticated;
grant select on public.fernwartung_protokoll to authenticated;
