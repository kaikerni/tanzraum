-- Vereinsadmin legt je Bereich fest, welche Rollen Zugriff haben (Admin immer):
--   fahrgemeinschaften -> Recht "fahrgemeinschaften" (Standard: alle Mitglieder)
--   kostueme           -> Recht "material"           (Standard: Betreuer)
--   finanzen           -> Recht "beitraege"          (Standard: nur Admin)
--   statistiken        -> Recht "statistiken"        (Standard: nur Admin)
-- Einzelrechte pro Mitglied (vereins_mitglieder.bereiche) gelten zusaetzlich weiter.
-- Ausserdem: Inhalte der Vereinsstatistik waehlt der Vereinsadmin (vereine.statistik_inhalte).

create table if not exists public.verein_bereich_zugang (
  verein_id uuid not null references public.vereine(id) on delete cascade,
  bereich text not null check (bereich in ('fahrgemeinschaften', 'kostueme', 'finanzen', 'statistiken')),
  rollen text[] not null default '{}' check (rollen <@ array['trainer', 'betreuer', 'mitglied', 'eltern', 'sonstige']),
  geaendert_am timestamptz not null default now(),
  primary key (verein_id, bereich)
);
alter table public.verein_bereich_zugang enable row level security;
drop policy if exists "Vereinsmitglieder sehen Bereichszugang" on public.verein_bereich_zugang;
create policy "Vereinsmitglieder sehen Bereichszugang" on public.verein_bereich_zugang for select to authenticated
  using (is_verein_admin(verein_id) or fernwartung_aktiv(verein_id));
revoke insert, update, delete, truncate on public.verein_bereich_zugang from anon, authenticated;

create or replace function public.bereich_standard_rollen(p_bereich text)
 returns text[]
 language sql
 immutable
 set search_path to 'public'
as $function$
  select case p_bereich
    when 'fahrgemeinschaften' then array['trainer', 'betreuer', 'mitglied', 'eltern', 'sonstige']
    when 'kostueme' then array['betreuer']
    else array[]::text[]
  end;
$function$;

create or replace function public.bereich_rollen(p_verein_id uuid, p_bereich text)
 returns text[]
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select coalesce((select z.rollen from verein_bereich_zugang z where z.verein_id = p_verein_id and z.bereich = p_bereich),
                  bereich_standard_rollen(p_bereich));
$function$;

-- Rollen-Standard: Material/Beitraege kommen jetzt aus der Bereichskonfiguration
create or replace function public.bereiche_fuer_rolle(p_rolle text)
 returns text[]
 language sql
 immutable
 set search_path to 'public'
as $function$
  select case rollen_typ(p_rolle)
    when 'admin' then array['mitglieder','anwesenheit','beitraege','material','saison','netzwerk','beitritt']
    when 'trainer' then array['mitglieder','anwesenheit','saison','netzwerk']
    when 'betreuer' then array['mitglieder','anwesenheit']
    else array[]::text[]
  end;
$function$;

create or replace function public.meine_bereiche()
 returns table(verein_id uuid, bereich text)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  with m as (
    select vm.verein_id, vm.bereiche, rollen_typ(r.name) as typ, r.name as rolle
    from vereins_mitglieder vm
    left join rollen r on r.id = vm.rolle_id
    where vm.user_id = auth.uid()
      and coalesce(vm.aktiv, true)
      and verein_hat_lizenz(vm.verein_id)
  )
  select m.verein_id, b.bereich
  from m
  cross join lateral unnest(
    case
      when m.typ = 'admin' then bereiche_fuer_rolle(m.rolle)
      when cardinality(array(select x from unnest(m.bereiche) x where x = any(gueltige_bereiche()))) > 0
        then array(select distinct x from unnest(m.bereiche) x where x = any(gueltige_bereiche()))
      else bereiche_fuer_rolle(m.rolle)
    end) as b(bereich)
  union
  select m.verein_id, 'rolle_' || m.typ from m
  union
  -- Vom Vereinsadmin je Rolle freigegebene Bereiche
  select m.verein_id, z.recht
  from m
  cross join (values ('fahrgemeinschaften', 'fahrgemeinschaften'), ('kostueme', 'material'), ('finanzen', 'beitraege'), ('statistiken', 'statistiken')) as z(bereich, recht)
  where m.typ = 'admin' or m.typ = any(bereich_rollen(m.verein_id, z.bereich));
$function$;

create or replace function public.verein_bereich_zugang_setzen(p_verein_id uuid, p_bereich text, p_rollen text[])
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_fernwartung boolean := fernwartung_aktiv(p_verein_id);
begin
  if not (is_verein_admin(p_verein_id) or v_fernwartung) then
    raise exception 'Den Zugang zu Bereichen legt der Vereinsadmin fest.' using errcode = '42501';
  end if;
  if p_bereich not in ('fahrgemeinschaften', 'kostueme', 'finanzen', 'statistiken') then
    raise exception 'Unbekannter Bereich.' using errcode = 'P0001';
  end if;
  if not coalesce(p_rollen, '{}') <@ array['trainer', 'betreuer', 'mitglied', 'eltern', 'sonstige'] then
    raise exception 'Unbekannte Rolle.' using errcode = 'P0001';
  end if;
  insert into verein_bereich_zugang (verein_id, bereich, rollen, geaendert_am)
  values (p_verein_id, p_bereich, array(select distinct x from unnest(coalesce(p_rollen, '{}')) x order by x), now())
  on conflict (verein_id, bereich) do update set rollen = excluded.rollen, geaendert_am = now();
  if v_fernwartung and not is_verein_admin(p_verein_id) then
    perform fernwartung_protokollieren(p_verein_id, 'Zugang ' || p_bereich || ' geändert: ' || coalesce(array_to_string(p_rollen, ', '), '–'));
  end if;
end;
$function$;

create or replace function public.verein_bereich_zugaenge(p_verein_id uuid)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
begin
  if not (is_verein_admin(p_verein_id) or fernwartung_aktiv(p_verein_id)) then
    raise exception 'Nur für den Vereinsadmin.' using errcode = '42501';
  end if;
  return (select jsonb_object_agg(b, to_jsonb(bereich_rollen(p_verein_id, b)))
          from unnest(array['fahrgemeinschaften', 'kostueme', 'finanzen', 'statistiken']) b);
end;
$function$;

-- ---------------------------------------------------------------------------------------------
-- Vereinsstatistik: Inhalte waehlt der Vereinsadmin
-- ---------------------------------------------------------------------------------------------
alter table public.vereine add column if not exists statistik_inhalte text[] not null
  default array['mitglieder', 'rollen', 'altersklassen', 'gruppen', 'beteiligung', 'turniere'];
alter table public.vereine drop constraint if exists vereine_statistik_inhalte_gueltig;
alter table public.vereine add constraint vereine_statistik_inhalte_gueltig
  check (statistik_inhalte <@ array['mitglieder', 'rollen', 'altersklassen', 'gruppen', 'beteiligung', 'turniere']);

create or replace function public.verein_statistik_inhalte_setzen(p_verein_id uuid, p_inhalte text[])
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if not (is_verein_admin(p_verein_id) or fernwartung_aktiv(p_verein_id)) then
    raise exception 'Die Inhalte der Statistik legt der Vereinsadmin fest.' using errcode = '42501';
  end if;
  if not coalesce(p_inhalte, '{}') <@ array['mitglieder', 'rollen', 'altersklassen', 'gruppen', 'beteiligung', 'turniere'] then
    raise exception 'Unbekannter Inhalt.' using errcode = 'P0001';
  end if;
  update vereine set statistik_inhalte = array(select distinct x from unnest(coalesce(p_inhalte, '{}')) x) where id = p_verein_id;
  if fernwartung_aktiv(p_verein_id) and not is_verein_admin(p_verein_id) then
    perform fernwartung_protokollieren(p_verein_id, 'Statistik-Inhalte geändert');
  end if;
end;
$function$;

-- Zusammengefasste Vereinszahlen (keine Namen) fuer alle mit Recht "statistiken"
create or replace function public.verein_statistik(p_verein_id uuid)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  v_inhalte text[];
  v jsonb := '{}'::jsonb;
  v_monate date[];
begin
  if not (ist_plattform_admin_aktuell() or exists (select 1 from meine_bereiche() mb where mb.verein_id = p_verein_id and mb.bereich = 'statistiken')) then
    raise exception 'Keine Berechtigung für die Vereinsstatistik.' using errcode = '42501';
  end if;
  if exists (select 1 from vereine x where x.id = p_verein_id and 'statistiken' = any(x.module_aus)) then
    raise exception 'Die Statistik ist in diesem Verein ausgeschaltet.' using errcode = 'P0001';
  end if;
  select statistik_inhalte into v_inhalte from vereine where id = p_verein_id;
  v := jsonb_build_object('inhalte', to_jsonb(v_inhalte));
  select array_agg(m::date order by m) into v_monate
  from generate_series(date_trunc('month', now()) - interval '11 months', date_trunc('month', now()), interval '1 month') m;

  if 'mitglieder' = any(v_inhalte) then
    v := v || jsonb_build_object('mitglieder', jsonb_build_object(
      'aktiv', (select count(*) from vereins_mitglieder vm where vm.verein_id = p_verein_id and coalesce(vm.aktiv, true) and vm.aufnahme_status = 'aufgenommen'),
      'neu', (select count(*) from vereins_mitglieder vm where vm.verein_id = p_verein_id and vm.aufnahme_status = 'neu'),
      'verlauf', (select jsonb_agg(jsonb_build_object('monat', to_char(m, 'YYYY-MM'),
                    'gesamt', (select count(*) from vereins_mitglieder vm where vm.verein_id = p_verein_id and coalesce(vm.aktiv, true)
                                 and vm.created_at < m + interval '1 month')) order by m) from unnest(v_monate) m)));
  end if;
  if 'rollen' = any(v_inhalte) then
    v := v || jsonb_build_object('rollen', coalesce((
      select jsonb_agg(jsonb_build_object('rolle', t, 'anzahl', n) order by n desc) from (
        select coalesce(r.name, 'Ohne Rolle') t, count(*) n from vereins_mitglieder vm left join rollen r on r.id = vm.rolle_id
        where vm.verein_id = p_verein_id and coalesce(vm.aktiv, true) group by 1) x), '[]'::jsonb));
  end if;
  if 'altersklassen' = any(v_inhalte) then
    v := v || jsonb_build_object('altersklassen', coalesce((
      select jsonb_agg(jsonb_build_object('altersklasse', t, 'anzahl', n) order by n desc) from (
        select coalesce(vm.altersklasse, 'Ohne Angabe') t, count(*) n from vereins_mitglieder vm
        where vm.verein_id = p_verein_id and coalesce(vm.aktiv, true) group by 1) x), '[]'::jsonb));
  end if;
  if 'gruppen' = any(v_inhalte) then
    v := v || jsonb_build_object('gruppen', coalesce((
      select jsonb_agg(jsonb_build_object('gruppe', g.name, 'anzahl', (select count(*) from gruppen_mitglieder gm where gm.gruppe_id = g.id)) order by g.name)
      from gruppen g where g.verein_id = p_verein_id), '[]'::jsonb));
  end if;
  if 'beteiligung' = any(v_inhalte) then
    v := v || jsonb_build_object('beteiligung', (select jsonb_agg(jsonb_build_object('monat', to_char(m, 'YYYY-MM'),
      'prozent', (select round(100.0 * count(*) filter (where ta.anwesend) / nullif(count(*), 0), 1) from trainings_anwesenheit ta
                  where ta.verein_id = p_verein_id and ta.datum >= m and ta.datum < m + interval '1 month')) order by m) from unnest(v_monate) m));
  end if;
  if 'turniere' = any(v_inhalte) and not exists (select 1 from vereine x where x.id = p_verein_id and 'turniere' = any(x.module_aus)) then
    v := v || jsonb_build_object('turniere', jsonb_build_object(
      'starts', (select count(*) from turnier_starts ts where ts.verein_id = p_verein_id and ts.tag >= date_trunc('year', now())::date),
      'podest', (select count(*) from turnier_starts ts where ts.verein_id = p_verein_id and ts.tag >= date_trunc('year', now())::date and ts.platz between 1 and 3),
      'siege', (select count(*) from turnier_starts ts where ts.verein_id = p_verein_id and ts.tag >= date_trunc('year', now())::date and ts.platz = 1)));
  end if;
  return v;
end;
$function$;

revoke execute on function public.bereich_rollen(uuid, text) from public, anon, authenticated;
revoke execute on function public.verein_bereich_zugang_setzen(uuid, text, text[]), public.verein_bereich_zugaenge(uuid),
  public.verein_statistik_inhalte_setzen(uuid, text[]), public.verein_statistik(uuid) from public, anon;
grant execute on function public.verein_bereich_zugang_setzen(uuid, text, text[]), public.verein_bereich_zugaenge(uuid),
  public.verein_statistik_inhalte_setzen(uuid, text[]), public.verein_statistik(uuid), public.bereich_standard_rollen(text) to authenticated;
grant select on public.verein_bereich_zugang to authenticated;
