-- TanzRaum Masterplan Phase 1: Kinderkonto im Verein, Disziplinen/Formationen, Vereinsfunktionen, Trainingsabmeldung
--
-- 1) Kinderkonto ohne Elternzustimmung mit Vereinszuordnung: Login bleibt gesperrt, Konto wird NIE automatisch geloescht
--    (auch nicht bei Ablehnung) und bleibt fuer den Verein sichtbar und verwaltbar.
-- 2) Disziplinen nach aktueller Terminologie (Solist weiblich/maennlich, Tanzgarden, Gemischte Garde nur Ue15),
--    Zuordnung Altersklasse -> Disziplin; Formationen (konkrete Besetzung einer Disziplin) getrennt von Gruppen.
-- 3) Freie Vereinsfunktionen (Vorstand, Haestraeger, Musiker ...) zusaetzlich zu den festen Systemrollen.
-- 4) Trainingsabmeldung: feste Gruende, Hinweis, eingetragen von, Selbst-/Eltern-/manuelle Abmeldung.

-- ---------------------------------------------------------------------------------------------
-- 1) Kinderkonto: Vereinszuordnung schuetzt vor Loeschung
-- ---------------------------------------------------------------------------------------------
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
    if z.herkunft = 'registrierung' and not exists (select 1 from vereins_mitglieder vm where vm.user_id = z.kind_id) then
      -- Keine Zustimmung: neu angelegtes Kinderkonto ohne Verein sofort loeschen (inkl. Profil und Zustimmungsdatensatz).
      -- Mit Vereinszuordnung bleibt das Konto gesperrt bestehen und im Verein sichtbar.
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
      -- Konten mit Vereinszuordnung bleiben gesperrt erhalten und im Verein sichtbar (nie automatisch loeschen)
      and not exists (select 1 from vereins_mitglieder vm where vm.user_id = u.id)
    returning u.id)
  select count(*) into v_anzahl from weg;
  if v_anzahl > 0 then
    insert into kinderkonto_loeschungen (anzahl) values (v_anzahl);
  end if;
  return v_anzahl;
end;
$function$;


-- ---------------------------------------------------------------------------------------------
-- 2) Disziplinen, Altersklassen, Formationen
-- ---------------------------------------------------------------------------------------------
alter table public.disziplinen add column besetzung text not null default 'gruppe' check (besetzung in ('solo', 'paar', 'gruppe'));
alter table public.disziplinen add column mit_thema boolean not null default false;

update public.disziplinen set name = 'Solist weiblich', besetzung = 'solo', sortierung = 4 where name = 'Tanzmariechen';
update public.disziplinen set name = 'Solist männlich', besetzung = 'solo', sortierung = 5 where name = 'Tanzmajor';
update public.disziplinen set name = 'Tanzgarden', besetzung = 'gruppe', sortierung = 1 where name = 'Weibliche Garde';
update public.disziplinen set besetzung = 'gruppe', sortierung = 2 where name = 'Gemischte Garde';
update public.disziplinen set besetzung = 'paar', sortierung = 3 where name = 'Tanzpaare';
update public.disziplinen set besetzung = 'gruppe', mit_thema = true, sortierung = 6 where name = 'Schautanz';
-- "Maennliche Garde" gibt es in der aktuellen Terminologie nicht mehr; nur loeschen, wenn nirgends verwendet
do $$
declare
  v_id uuid := (select id from public.disziplinen where name = 'Männliche Garde');
begin
  if v_id is not null then
    if exists (select 1 from public.gruppen where disziplin_id = v_id)
       or exists (select 1 from public.turnier_starts where disziplin_id = v_id)
       or exists (select 1 from public.verband_disziplinen where disziplin_id = v_id) then
      update public.disziplinen set name = 'Männliche Garde (nicht mehr verwendet)', sortierung = 99 where id = v_id;
    else
      delete from public.disziplinen where id = v_id;
    end if;
  end if;
end $$;

-- Welche Disziplinen es in welcher Altersklasse gibt (Gemischte Garde nur Ue15)
create table public.altersklasse_disziplinen (
  altersklasse_id uuid not null references public.altersklassen(id) on delete cascade,
  disziplin_id uuid not null references public.disziplinen(id) on delete cascade,
  primary key (altersklasse_id, disziplin_id)
);
insert into public.altersklasse_disziplinen (altersklasse_id, disziplin_id)
select a.id, d.id from public.altersklassen a cross join public.disziplinen d
where d.name in ('Tanzpaare', 'Tanzgarden', 'Solist weiblich', 'Solist männlich', 'Schautanz')
   or (d.name = 'Gemischte Garde' and a.name = 'Ü15')
on conflict do nothing;
alter table public.altersklasse_disziplinen enable row level security;
create policy "Angemeldete lesen Altersklassen-Disziplinen" on public.altersklasse_disziplinen for select to authenticated using (true);
revoke all on table public.altersklasse_disziplinen from public, anon;
grant select on table public.altersklasse_disziplinen to authenticated;
grant all on table public.altersklasse_disziplinen to service_role;

-- Formation = konkrete Besetzung einer Disziplin (z. B. Tanzpaar Anna + Max, Solist weiblich Anna, Schautanz mit Thema).
-- Die Personen bleiben eigenstaendige Vereinsmitglieder; eine Formation ist keine Vereinsgruppe.
create table public.formationen (
  id uuid primary key default gen_random_uuid(),
  verein_id uuid not null references public.vereine(id) on delete cascade,
  gruppe_id uuid references public.gruppen(id) on delete set null,
  disziplin_id uuid not null references public.disziplinen(id),
  altersklasse_id uuid references public.altersklassen(id),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  thema text check (thema is null or char_length(thema) <= 300),
  aktiv boolean not null default true,
  erstellt_von uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index formationen_verein_idx on public.formationen (verein_id);

create table public.formation_mitglieder (
  formation_id uuid not null references public.formationen(id) on delete cascade,
  vereins_mitglied_id uuid not null references public.vereins_mitglieder(id) on delete cascade,
  -- optionaler Auftritts-/Kuenstlername; der Mitgliedsname bleibt unveraendert die Stammdateninformation
  auftrittsname text check (auftrittsname is null or char_length(auftrittsname) <= 80),
  created_at timestamptz not null default now(),
  primary key (formation_id, vereins_mitglied_id)
);
create index formation_mitglieder_vm_idx on public.formation_mitglieder (vereins_mitglied_id);

create or replace function public.formation_pruefen()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  new.name := btrim(new.name);
  new.thema := nullif(btrim(coalesce(new.thema, '')), '');
  new.updated_at := now();
  if new.gruppe_id is not null and not exists (select 1 from gruppen g where g.id = new.gruppe_id and g.verein_id = new.verein_id) then
    raise exception 'Die Gruppe gehört nicht zu diesem Verein.' using errcode = 'P0001';
  end if;
  if new.altersklasse_id is not null and not exists (
       select 1 from altersklasse_disziplinen ad where ad.altersklasse_id = new.altersklasse_id and ad.disziplin_id = new.disziplin_id) then
    raise exception 'Diese Disziplin gibt es in der gewählten Altersklasse nicht.' using errcode = 'P0001';
  end if;
  if tg_op = 'UPDATE' and new.verein_id is distinct from old.verein_id then
    raise exception 'Der Verein einer Formation kann nicht geändert werden.' using errcode = 'P0001';
  end if;
  return new;
end;
$function$;
create trigger formation_pruefen before insert or update on public.formationen
  for each row execute function public.formation_pruefen();

-- Besetzung: Solo hoechstens 1 Person, Paar hoechstens 2; nur Mitglieder desselben Vereins.
-- Keine Geschlechtsvorgabe in der Datenbank (die BDK-Regel gilt nur im Turnierkontext, siehe formation_bdk_hinweis).
create or replace function public.formation_mitglied_pruefen()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_besetzung text;
  v_verein uuid;
  v_max int;
begin
  select d.besetzung, f.verein_id into v_besetzung, v_verein
  from formationen f join disziplinen d on d.id = f.disziplin_id where f.id = new.formation_id;
  if not exists (select 1 from vereins_mitglieder vm where vm.id = new.vereins_mitglied_id and vm.verein_id = v_verein) then
    raise exception 'Nur Mitglieder dieses Vereins können zur Formation gehören.' using errcode = 'P0001';
  end if;
  new.auftrittsname := nullif(btrim(coalesce(new.auftrittsname, '')), '');
  v_max := case v_besetzung when 'solo' then 1 when 'paar' then 2 else null end;
  if v_max is not null and tg_op = 'INSERT'
     and (select count(*) from formation_mitglieder fm where fm.formation_id = new.formation_id) >= v_max then
    raise exception '%', case v_besetzung when 'solo' then 'Eine Solo-Formation besteht aus genau einer Person.'
                              else 'Ein Tanzpaar besteht aus zwei Personen.' end using errcode = 'P0001';
  end if;
  return new;
end;
$function$;
create trigger formation_mitglied_pruefen before insert or update on public.formation_mitglieder
  for each row execute function public.formation_mitglied_pruefen();

-- BDK-Hinweis fuer Tanzpaare (nur Turnierkontext): eine weibliche und eine maennliche Person.
-- null = passt oder nicht relevant; sonst Hinweistext.
create or replace function public.formation_bdk_hinweis(p_formation uuid)
 returns text
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  v_verein uuid;
  v_besetzung text;
  v_anzahl int;
  v_w int;
  v_m int;
  v_unbekannt int;
begin
  select f.verein_id, d.besetzung into v_verein, v_besetzung
  from formationen f join disziplinen d on d.id = f.disziplin_id where f.id = p_formation;
  if v_verein is null or not (v_verein = any (meine_vereine()) or ist_plattform_admin_aktuell()) then
    return null;
  end if;
  if v_besetzung <> 'paar' then return null; end if;
  select count(*),
         count(*) filter (where geschlecht_normal(p.geschlecht) = 'weiblich'),
         count(*) filter (where geschlecht_normal(p.geschlecht) = 'männlich'),
         count(*) filter (where p.geschlecht is null)
    into v_anzahl, v_w, v_m, v_unbekannt
  from formation_mitglieder fm join vereins_mitglieder vm on vm.id = fm.vereins_mitglied_id
  left join profiles p on p.id = vm.user_id
  where fm.formation_id = p_formation;
  if v_anzahl < 2 then return 'Für ein Tanzpaar fehlt noch eine Person.'; end if;
  if v_unbekannt > 0 then return 'BDK: Das Geschlecht ist nicht bei beiden Personen hinterlegt – bitte selbst prüfen.'; end if;
  if v_w = 1 and v_m = 1 then return null; end if;
  return 'BDK-Turniere: Ein Tanzpaar besteht aus einer weiblichen und einer männlichen Person. Bei anderen Veranstaltungen kann das anders sein.';
end;
$function$;

alter table public.formationen enable row level security;
alter table public.formation_mitglieder enable row level security;
create policy "Vereinsmitglieder sehen Formationen ihres Vereins" on public.formationen for select to authenticated
  using (verein_id = any (meine_vereine()) or ist_plattform_admin_aktuell());
create policy "Vereinsadmin/Trainer verwalten Formationen" on public.formationen for all to authenticated
  using (is_verein_admin_oder_trainer(verein_id)) with check (is_verein_admin_oder_trainer(verein_id));
create policy "Vereinsmitglieder sehen Formationsbesetzungen" on public.formation_mitglieder for select to authenticated
  using (exists (select 1 from formationen f where f.id = formation_mitglieder.formation_id
                 and (f.verein_id = any (meine_vereine()) or ist_plattform_admin_aktuell())));
create policy "Vereinsadmin/Trainer verwalten Formationsbesetzungen" on public.formation_mitglieder for all to authenticated
  using (exists (select 1 from formationen f where f.id = formation_mitglieder.formation_id and is_verein_admin_oder_trainer(f.verein_id)))
  with check (exists (select 1 from formationen f where f.id = formation_mitglieder.formation_id and is_verein_admin_oder_trainer(f.verein_id)));
revoke all on table public.formationen, public.formation_mitglieder from public, anon;
grant select, insert, update, delete on table public.formationen, public.formation_mitglieder to authenticated;
grant all on table public.formationen, public.formation_mitglieder to service_role;

-- Das Thema gehoert zur Formation und ist optional (§16): bisherige Pflicht "Thema bei Schautanz-Gruppe" entfaellt
drop trigger if exists gruppen_thema_check on public.gruppen;
drop function if exists public.check_gruppen_thema();

-- Startplanung (keine Turnieranmeldung): optionaler Bezug zu einer Formation
alter table public.turnier_starts add column formation_id uuid references public.formationen(id) on delete set null;
create or replace function public.turnier_start_formation_pruefen()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if new.formation_id is not null
     and not exists (select 1 from formationen f where f.id = new.formation_id and f.verein_id = new.verein_id) then
    raise exception 'Die Formation gehört nicht zu diesem Verein.' using errcode = 'P0001';
  end if;
  return new;
end;
$function$;
create trigger turnier_start_formation_pruefen before insert or update of formation_id on public.turnier_starts
  for each row execute function public.turnier_start_formation_pruefen();

-- ---------------------------------------------------------------------------------------------
-- 3) Freie Vereinsfunktionen (zusaetzlich zu den festen Systemrollen; vergeben keine Rechte)
-- ---------------------------------------------------------------------------------------------
create table public.verein_funktionen (
  id uuid primary key default gen_random_uuid(),
  verein_id uuid not null references public.vereine(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  sortierung integer not null default 0,
  created_at timestamptz not null default now()
);
create unique index verein_funktionen_name_idx on public.verein_funktionen (verein_id, lower(btrim(name)));

create table public.mitglied_funktionen (
  vereins_mitglied_id uuid not null references public.vereins_mitglieder(id) on delete cascade,
  funktion_id uuid not null references public.verein_funktionen(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (vereins_mitglied_id, funktion_id)
);
create index mitglied_funktionen_funktion_idx on public.mitglied_funktionen (funktion_id);

create or replace function public.mitglied_funktion_pruefen()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if not exists (select 1 from vereins_mitglieder vm join verein_funktionen f on f.verein_id = vm.verein_id
                 where vm.id = new.vereins_mitglied_id and f.id = new.funktion_id) then
    raise exception 'Funktion und Mitglied gehören nicht zum selben Verein.' using errcode = 'P0001';
  end if;
  return new;
end;
$function$;
create trigger mitglied_funktion_pruefen before insert or update on public.mitglied_funktionen
  for each row execute function public.mitglied_funktion_pruefen();

alter table public.verein_funktionen enable row level security;
alter table public.mitglied_funktionen enable row level security;
create policy "Vereinsmitglieder sehen Vereinsfunktionen" on public.verein_funktionen for select to authenticated
  using (verein_id = any (meine_vereine()) or ist_plattform_admin_aktuell());
create policy "Mitgliederverwaltung pflegt Vereinsfunktionen" on public.verein_funktionen for all to authenticated
  using (hat_vereinsbereich(verein_id, 'mitglieder')) with check (hat_vereinsbereich(verein_id, 'mitglieder'));
create policy "Vereinsmitglieder sehen Funktionszuordnungen" on public.mitglied_funktionen for select to authenticated
  using (exists (select 1 from verein_funktionen f where f.id = mitglied_funktionen.funktion_id
                 and (f.verein_id = any (meine_vereine()) or ist_plattform_admin_aktuell())));
create policy "Mitgliederverwaltung ordnet Funktionen zu" on public.mitglied_funktionen for all to authenticated
  using (exists (select 1 from verein_funktionen f where f.id = mitglied_funktionen.funktion_id and hat_vereinsbereich(f.verein_id, 'mitglieder')))
  with check (exists (select 1 from verein_funktionen f where f.id = mitglied_funktionen.funktion_id and hat_vereinsbereich(f.verein_id, 'mitglieder')));
revoke all on table public.verein_funktionen, public.mitglied_funktionen from public, anon;
grant select, insert, update, delete on table public.verein_funktionen, public.mitglied_funktionen to authenticated;
grant all on table public.verein_funktionen, public.mitglied_funktionen to service_role;

-- ---------------------------------------------------------------------------------------------
-- 4) Trainingsabmeldung: feste Gruende, Hinweis, wer hat eingetragen (selbst / Eltern / manuell)
-- ---------------------------------------------------------------------------------------------
alter table public.trainings_abmeldungen
  add column grund_kategorie text check (grund_kategorie in ('krankheit', 'urlaub', 'schule', 'arbeit', 'familie', 'verletzung', 'sonstiges')),
  add column hinweis text check (hinweis is null or char_length(hinweis) <= 300),
  add column eingetragen_von uuid,
  add column quelle text check (quelle in ('selbst', 'eltern', 'manuell'));

create or replace function public.trainings_abmeldung_vorbereiten()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_kind_user uuid;
  v_label text;
begin
  select vm.user_id into v_kind_user from vereins_mitglieder vm where vm.id = new.vereins_mitglied_id;
  new.eingetragen_von := auth.uid();
  new.quelle := case
    when auth.uid() is not null and auth.uid() = v_kind_user then 'selbst'
    when auth.uid() is not null and (ist_elternteil_von(auth.uid(), v_kind_user) or exists (
           select 1 from eltern_kind_zuordnung ekz join vereins_mitglieder e on e.id = ekz.eltern_vm_id
           where ekz.kind_vm_id = new.vereins_mitglied_id and e.user_id = auth.uid())) then 'eltern'
    else 'manuell'
  end;
  new.hinweis := nullif(btrim(coalesce(new.hinweis, '')), '');
  if new.grund_kategorie is not null then
    v_label := case new.grund_kategorie
      when 'krankheit' then 'Krankheit' when 'urlaub' then 'Urlaub' when 'schule' then 'Schule / Ausbildung'
      when 'arbeit' then 'Arbeit' when 'familie' then 'Familie / privater Termin' when 'verletzung' then 'Verletzung'
      else 'Sonstiges' end;
    -- Anzeigetext fuer bestehende Uebersichten (Trainerliste, Kalender)
    new.grund := left(v_label || coalesce(' – ' || new.hinweis, '')
                      || case new.quelle when 'manuell' then ' (manuell eingetragen)' when 'eltern' then ' (von den Eltern)' else '' end, 300);
  end if;
  return new;
end;
$function$;
create trigger trainings_abmeldung_vorbereiten before insert on public.trainings_abmeldungen
  for each row execute function public.trainings_abmeldung_vorbereiten();

-- ---------------------------------------------------------------------------------------------
-- Rechte der neuen Hilfsfunktionen
-- ---------------------------------------------------------------------------------------------
revoke all on function public.formation_pruefen(), public.formation_mitglied_pruefen(), public.turnier_start_formation_pruefen(),
  public.mitglied_funktion_pruefen(), public.trainings_abmeldung_vorbereiten() from public, anon, authenticated;
revoke all on function public.formation_bdk_hinweis(uuid) from public, anon;
grant execute on function public.formation_bdk_hinweis(uuid) to authenticated, service_role;

-- Startplanung: Formation in der Vereinsansicht der Starts mitliefern
drop function if exists public.vereins_starts(uuid, date, date, uuid);

CREATE FUNCTION public.vereins_starts(p_verein_id uuid, p_von date, p_bis date, p_turnier_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, turnier_id uuid, turnier_name text, turnier_ort text, erster_tag date, letzter_tag date, turnier_tage jsonb, meldeschluss date, eigenes_turnier boolean, gruppe_id uuid, gruppe_name text, bezeichnung text, solisten uuid[], solisten_namen text, disziplin_id uuid, disziplin text, altersklasse_id uuid, altersklasse text, tag date, startnummer text, status text, notiz text, platz integer, punkte numeric, ergebnis_notiz text, dabei integer, nicht_dabei integer, unsicher integer, teilnehmer integer, darf_bearbeiten boolean, formation_id uuid, formation_name text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not ((p_verein_id = any(meine_vereine()) and verein_hat_lizenz(p_verein_id)) or ist_plattform_admin_aktuell()) then
    return;
  end if;
  return query
  with st as (
    select s.*, t.name as t_name, t.ort as t_ort, t.tage as t_tage, t.meldeschluss as t_meldeschluss, t.verein_id as t_verein,
      (select min((e->>'datum')::date) from jsonb_array_elements(t.tage) e) as von_d,
      (select max((e->>'datum')::date) from jsonb_array_elements(t.tage) e) as bis_d
    from turnier_starts s join turniere t on t.id = s.turnier_id
    where s.verein_id = p_verein_id and (p_turnier_id is null or s.turnier_id = p_turnier_id)
  )
  select st.id, st.turnier_id, st.t_name, st.t_ort, st.von_d, st.bis_d, st.t_tage, st.t_meldeschluss, st.t_verein is not null,
    st.gruppe_id, g.name, st.bezeichnung, st.solisten,
    (select string_agg(a.anzeige, ', ' order by a.anzeige) from anzeige_namen(
        (select array_agg(vm.user_id) from vereins_mitglieder vm where vm.id = any(st.solisten))) a),
    st.disziplin_id, d.name, st.altersklasse_id, ak.name, st.tag, st.startnummer, st.status, st.notiz,
    st.platz, st.punkte, st.ergebnis_notiz,
    (select count(*)::int from turnier_start_rueckmeldungen r where r.start_id = st.id and r.status = 'dabei'),
    (select count(*)::int from turnier_start_rueckmeldungen r where r.start_id = st.id and r.status = 'nicht_dabei'),
    (select count(*)::int from turnier_start_rueckmeldungen r where r.start_id = st.id and r.status = 'unsicher'),
    (select count(*)::int from start_teilnehmer_ids(st.id)),
    darf_vereinstermine_verwalten(p_verein_id),
    st.formation_id, fo.name
  from st
  left join gruppen g on g.id = st.gruppe_id
  left join disziplinen d on d.id = st.disziplin_id
  left join altersklassen ak on ak.id = st.altersklasse_id
  left join formationen fo on fo.id = st.formation_id
  where st.bis_d >= p_von and st.von_d <= p_bis
  order by st.von_d, st.t_name, st.tag nulls first, g.name nulls last, st.bezeichnung;
end;
$function$
;

revoke all on function public.vereins_starts(uuid, date, date, uuid) from public, anon;
grant execute on function public.vereins_starts(uuid, date, date, uuid) to authenticated, service_role;
