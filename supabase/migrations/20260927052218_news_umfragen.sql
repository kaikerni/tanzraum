-- TanzRaum Masterplan Phase 3: News und Vereinsumfragen
--
-- - News = offizielle Vereinsinformationen, Umfragen = Abstimmungen im Verein (nicht die Chat-Umfragen).
-- - Zielgruppen (jsonb-Liste): {"art":"verein"} | {"art":"gruppe","id":..} | {"art":"eltern_gruppe","id":..}
--   | {"art":"rolle","rolle":"admin|trainer|betreuer|mitglied|eltern"}.
-- - Die Empfaenger werden bei der Veroeffentlichung festgehalten (Grundlage fuer "18 von 22 gelesen").
-- - Verfassen: Vereinsadmin immer (alle Zielgruppen); Rollen, die der Vereinsadmin freigibt (Trainer, Betreuer),
--   nur fuer Gruppen, in denen sie Trainer/Betreuer sind (inkl. Eltern dieser Gruppen). Nur mit Vereinslizenz.
-- - Wichtige News: Popup, bis die Person sie als gelesen bestaetigt; Lesestatus mit Zeitpunkt.
-- - Optional Push (Kategorien "news" bzw. "wichtige_news").

-- ---------------------------------------------------------------------------------------------
-- Rollenfamilien und Freigabe der Verfasser-Rollen je Verein
-- ---------------------------------------------------------------------------------------------
create or replace function public.rolle_familie(p_rolle text)
 returns text
 language sql
 immutable
 set search_path to 'public'
as $function$
  select case
    when lower(coalesce(p_rolle, '')) like '%admin%' then 'admin'
    when lower(p_rolle) like '%trainer%' then 'trainer'
    when lower(p_rolle) like '%betreuer%' then 'betreuer'
    when lower(p_rolle) in ('eltern', 'mutter', 'vater') then 'eltern'
    when lower(p_rolle) like 't_nzer%' or lower(p_rolle) like 'tänzer%' then 'mitglied'
    else 'sonstige' end;
$function$;

alter table public.vereine add column news_rollen text[] not null default '{trainer}'
  check (news_rollen <@ array['trainer', 'betreuer']::text[]);
comment on column public.vereine.news_rollen is 'Rollen (ausser Vereinsadmin), die News und Umfragen fuer ihre eigenen Gruppen erstellen duerfen.';

create or replace function public.news_rollen_setzen(p_verein uuid, p_rollen text[])
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if not is_verein_admin(p_verein) then
    raise exception 'Nur der Vereinsadmin kann festlegen, wer News erstellen darf.' using errcode = '42501';
  end if;
  update vereine set news_rollen = coalesce((select array_agg(distinct r) from unnest(p_rollen) r where r in ('trainer', 'betreuer')), '{}')
  where id = p_verein;
end;
$function$;

-- Gruppen, fuer die die angemeldete Person News verfassen darf (null = alle, Vereinsadmin)
create or replace function public.news_eigene_gruppen(p_verein uuid)
 returns uuid[]
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select case when is_verein_admin(p_verein) then null else coalesce((
    select array_agg(distinct gm.gruppe_id)
    from vereins_mitglieder vm
    join rollen r on r.id = vm.rolle_id
    join gruppen_mitglieder gm on gm.vereins_mitglied_id = vm.id and gm.funktion in ('trainer', 'betreuer')
    join vereine v on v.id = vm.verein_id
    where vm.verein_id = p_verein and vm.user_id = auth.uid() and coalesce(vm.aktiv, true)
      and rolle_familie(r.name) = any (v.news_rollen)), '{}'::uuid[]) end;
$function$;

create or replace function public.darf_news_verfassen(p_verein uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select auth.uid() is not null and verein_hat_lizenz(p_verein)
     and (is_verein_admin(p_verein) or cardinality(news_eigene_gruppen(p_verein)) > 0);
$function$;

-- Zielgruppen pruefen (Form, Zugehoerigkeit zum Verein, Berechtigung)
create or replace function public.ziele_pruefen(p_verein uuid, p_ziele jsonb)
 returns void
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  z jsonb;
  v_eigene uuid[] := news_eigene_gruppen(p_verein);
  v_gruppe uuid;
begin
  if jsonb_typeof(p_ziele) <> 'array' or jsonb_array_length(p_ziele) = 0 or jsonb_array_length(p_ziele) > 50 then
    raise exception 'Bitte mindestens eine Zielgruppe wählen.' using errcode = 'P0001';
  end if;
  for z in select * from jsonb_array_elements(p_ziele) loop
    case z->>'art'
      when 'verein' then
        if v_eigene is not null then
          raise exception 'An den ganzen Verein kann nur der Vereinsadmin schreiben.' using errcode = '42501';
        end if;
      when 'rolle' then
        if v_eigene is not null then
          raise exception 'An Rollen kann nur der Vereinsadmin schreiben.' using errcode = '42501';
        end if;
        if coalesce(z->>'rolle', '') not in ('admin', 'trainer', 'betreuer', 'mitglied', 'eltern') then
          raise exception 'Unbekannte Rolle.' using errcode = 'P0001';
        end if;
      when 'gruppe', 'eltern_gruppe' then
        begin
          v_gruppe := (z->>'id')::uuid;
        exception when others then
          raise exception 'Unbekannte Gruppe.' using errcode = 'P0001';
        end;
        if not exists (select 1 from gruppen g where g.id = v_gruppe and g.verein_id = p_verein) then
          raise exception 'Die Gruppe gehört nicht zu diesem Verein.' using errcode = 'P0001';
        end if;
        if v_eigene is not null and not (v_gruppe = any (v_eigene)) then
          raise exception 'Du kannst nur an Gruppen schreiben, die du als Trainer oder Betreuer begleitest.' using errcode = '42501';
        end if;
      else
        raise exception 'Unbekannte Zielgruppe.' using errcode = 'P0001';
    end case;
  end loop;
end;
$function$;

-- Empfaenger einer Zielgruppen-Liste (aktive Vereinsmitglieder; Eltern ueber Vereins- oder Kontoverknuepfung)
create or replace function public.ziel_empfaenger(p_verein uuid, p_ziele jsonb)
 returns table(user_id uuid)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  with z as (select e->>'art' as art, e->>'id' as id, e->>'rolle' as rolle from jsonb_array_elements(p_ziele) e),
  mitglieder as (select vm.* from vereins_mitglieder vm where vm.verein_id = p_verein and coalesce(vm.aktiv, true)),
  gruppenkinder as (
    select vm.id as vm_id, vm.user_id from mitglieder vm
    join gruppen_mitglieder gm on gm.vereins_mitglied_id = vm.id
    join z on z.art = 'eltern_gruppe' and gm.gruppe_id::text = z.id)
  select distinct u from (
    select vm.user_id as u from mitglieder vm where exists (select 1 from z where z.art = 'verein')
    union all
    select vm.user_id from mitglieder vm join gruppen_mitglieder gm on gm.vereins_mitglied_id = vm.id
      join z on z.art = 'gruppe' and gm.gruppe_id::text = z.id
    union all
    select vm.user_id from mitglieder vm join rollen r on r.id = vm.rolle_id join z on z.art = 'rolle' and rolle_familie(r.name) = z.rolle
    union all
    select e.user_id from gruppenkinder k join eltern_kind_zuordnung ekz on ekz.kind_vm_id = k.vm_id
      join vereins_mitglieder e on e.id = ekz.eltern_vm_id
    union all
    select ev.eltern_id from gruppenkinder k join eltern_verknuepfungen ev on ev.kind_id = k.user_id and ev.status = 'bestaetigt'
  ) x(u)
  where u is not null;
$function$;

-- ---------------------------------------------------------------------------------------------
-- News
-- ---------------------------------------------------------------------------------------------
create table public.news (
  id uuid primary key default gen_random_uuid(),
  verein_id uuid not null references public.vereine(id) on delete cascade,
  titel text not null check (char_length(btrim(titel)) between 1 and 150),
  text text not null check (char_length(text) <= 5000),
  wichtig boolean not null default false,
  push boolean not null default false,
  ziele jsonb not null,
  erstellt_von uuid references auth.users(id) on delete set null,
  erstellt_am timestamptz not null default now(),
  geaendert_am timestamptz
);
create index news_verein_idx on public.news (verein_id, erstellt_am desc);

create table public.news_empfaenger (
  news_id uuid not null references public.news(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  gelesen_am timestamptz,
  primary key (news_id, user_id)
);
create index news_empfaenger_user_idx on public.news_empfaenger (user_id, gelesen_am);

create or replace function public.darf_news_verwalten(p_news uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select exists (select 1 from news n where n.id = p_news and (n.erstellt_von = auth.uid() or is_verein_admin(n.verein_id)));
$function$;

alter table public.news enable row level security;
alter table public.news_empfaenger enable row level security;
create policy "Empfaenger und Verantwortliche sehen News" on public.news for select to authenticated
  using (verein_hat_lizenz(verein_id) and (
    exists (select 1 from news_empfaenger e where e.news_id = news.id and e.user_id = auth.uid())
    or erstellt_von = auth.uid() or is_verein_admin(verein_id)));
create policy "Eigener Lesestatus" on public.news_empfaenger for select to authenticated using (user_id = auth.uid());
revoke all on table public.news, public.news_empfaenger from public, anon;
grant select on table public.news, public.news_empfaenger to authenticated;
grant all on table public.news, public.news_empfaenger to service_role;

create or replace function public.news_veroeffentlichen(p_verein uuid, p_titel text, p_text text, p_wichtig boolean, p_push boolean, p_ziele jsonb)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_id uuid;
  v_titel text := btrim(coalesce(p_titel, ''));
  v_geheimnis text;
begin
  if not darf_news_verfassen(p_verein) then
    raise exception 'Du darfst in diesem Verein keine News veröffentlichen.' using errcode = '42501';
  end if;
  perform ziele_pruefen(p_verein, p_ziele);
  if v_titel = '' then raise exception 'Bitte einen Titel angeben.' using errcode = 'P0001'; end if;
  insert into news (verein_id, titel, text, wichtig, push, ziele, erstellt_von)
  values (p_verein, left(v_titel, 150), left(btrim(coalesce(p_text, '')), 5000), coalesce(p_wichtig, false), coalesce(p_push, false), p_ziele, auth.uid())
  returning id into v_id;
  insert into news_empfaenger (news_id, user_id) select v_id, e.user_id from ziel_empfaenger(p_verein, p_ziele) e;
  insert into benachrichtigungen (user_id, typ, text)
  select e.user_id, 'news', case when p_wichtig then 'Wichtig: ' else 'News: ' end || left(v_titel, 120)
  from news_empfaenger e where e.news_id = v_id and e.user_id <> auth.uid();
  if coalesce(p_push, false) then
    select decrypted_secret into v_geheimnis from vault.decrypted_secrets where name = 'chat_push_geheimnis';
    if v_geheimnis is not null then
      begin
        perform net.http_post(
          url := 'https://oraiqjulxmohclfixwdq.supabase.co/functions/v1/chat-push',
          body := jsonb_build_object('news_id', v_id),
          headers := jsonb_build_object('Content-Type', 'application/json', 'x-tanzraum-geheimnis', v_geheimnis),
          timeout_milliseconds := 5000);
      exception when others then null; -- Push darf das Veroeffentlichen nie verhindern
      end;
    end if;
  end if;
  return v_id;
end;
$function$;

-- Titel/Text korrigieren (Zielgruppe und "wichtig" bleiben, damit der Lesestatus stimmt)
create or replace function public.news_bearbeiten(p_news uuid, p_titel text, p_text text)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if not darf_news_verwalten(p_news) then raise exception 'Keine Berechtigung.' using errcode = '42501'; end if;
  if btrim(coalesce(p_titel, '')) = '' then raise exception 'Bitte einen Titel angeben.' using errcode = 'P0001'; end if;
  update news set titel = left(btrim(p_titel), 150), text = left(btrim(coalesce(p_text, '')), 5000), geaendert_am = now() where id = p_news;
end;
$function$;

create or replace function public.news_loeschen(p_news uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if not darf_news_verwalten(p_news) then raise exception 'Keine Berechtigung.' using errcode = '42501'; end if;
  delete from news where id = p_news;
end;
$function$;

create or replace function public.news_gelesen(p_news uuid[])
 returns void
 language sql
 security definer
 set search_path to 'public'
as $function$
  update news_empfaenger set gelesen_am = now()
  where user_id = auth.uid() and news_id = any (p_news) and gelesen_am is null;
$function$;

-- News-Liste der angemeldeten Person (als Empfaenger oder verantwortlich)
create or replace function public.meine_news(p_limit integer default 50)
 returns table(id uuid, verein_id uuid, verein_name text, titel text, text text, wichtig boolean, erstellt_am timestamptz,
               geaendert_am timestamptz, autor text, gelesen_am timestamptz, ist_empfaenger boolean, darf_verwalten boolean,
               empfaenger integer, gelesen integer, ziele jsonb)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select n.id, n.verein_id, v.name, n.titel, n.text, n.wichtig, n.erstellt_am, n.geaendert_am,
    (select a.anzeige from anzeige_namen(array[n.erstellt_von]) a),
    me.gelesen_am, me.user_id is not null,
    (n.erstellt_von = auth.uid() or is_verein_admin(n.verein_id)),
    case when n.erstellt_von = auth.uid() or is_verein_admin(n.verein_id) then (select count(*)::int from news_empfaenger e where e.news_id = n.id) end,
    case when n.erstellt_von = auth.uid() or is_verein_admin(n.verein_id) then (select count(*)::int from news_empfaenger e where e.news_id = n.id and e.gelesen_am is not null) end,
    case when n.erstellt_von = auth.uid() or is_verein_admin(n.verein_id) then n.ziele end
  from news n
  join vereine v on v.id = n.verein_id
  left join news_empfaenger me on me.news_id = n.id and me.user_id = auth.uid()
  where verein_hat_lizenz(n.verein_id)
    and (me.user_id is not null or n.erstellt_von = auth.uid() or is_verein_admin(n.verein_id))
  order by n.erstellt_am desc
  limit least(greatest(coalesce(p_limit, 50), 1), 200);
$function$;

-- Wichtige News, die noch bestaetigt werden muessen (Popup)
create or replace function public.meine_offenen_wichtigen_news()
 returns table(id uuid, verein_name text, titel text, text text, erstellt_am timestamptz, autor text)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select n.id, v.name, n.titel, n.text, n.erstellt_am, (select a.anzeige from anzeige_namen(array[n.erstellt_von]) a)
  from news_empfaenger e join news n on n.id = e.news_id join vereine v on v.id = n.verein_id
  where e.user_id = auth.uid() and e.gelesen_am is null and n.wichtig and verein_hat_lizenz(n.verein_id)
  order by n.erstellt_am;
$function$;

-- Lesestatus fuer Verfasser/Vereinsadmin
create or replace function public.news_lesestatus(p_news uuid)
 returns table(name text, gelesen_am timestamptz)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select coalesce(a.anzeige, 'Unbekannt'), e.gelesen_am
  from news_empfaenger e
  left join anzeige_namen(array(select e2.user_id from news_empfaenger e2 where e2.news_id = p_news)) a on a.user_id = e.user_id
  where e.news_id = p_news and darf_news_verwalten(p_news)
  order by e.gelesen_am nulls first, a.anzeige;
$function$;

-- Push-Ziele fuer eine News (Edge Function chat-push, Geheimnis aus dem Vault)
create or replace function public.news_push_ziele(p_geheimnis text, p_news_id uuid)
 returns table(abo_id uuid, endpoint text)
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if not interner_aufruf_ok(p_geheimnis) then
    raise exception 'Nicht berechtigt' using errcode = '42501';
  end if;
  return query
  select ps.id, ps.endpoint
  from news n
  join news_empfaenger e on e.news_id = n.id
  join push_subscriptions ps on ps.user_id = e.user_id
  where n.id = p_news_id and n.push and e.user_id is distinct from n.erstellt_von
    and push_kategorie_aktiv(e.user_id, case when n.wichtig then 'wichtige_news' else 'news' end);
end;
$function$;

-- Vorschau fuer den Service Worker (neueste frische News der angemeldeten Person)
create or replace function public.meine_push_news()
 returns table(id uuid, titel text, wichtig boolean, verein_name text)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select n.id, n.titel, n.wichtig, v.name
  from news_empfaenger e join news n on n.id = e.news_id join vereine v on v.id = n.verein_id
  where e.user_id = auth.uid() and e.gelesen_am is null and n.push and n.erstellt_am > now() - interval '3 minutes'
  order by n.erstellt_am desc limit 1;
$function$;

-- ---------------------------------------------------------------------------------------------
-- Vereinsumfragen
-- ---------------------------------------------------------------------------------------------
create table public.vereinsumfragen (
  id uuid primary key default gen_random_uuid(),
  verein_id uuid not null references public.vereine(id) on delete cascade,
  frage text not null check (char_length(btrim(frage)) between 1 and 300),
  beschreibung text check (beschreibung is null or char_length(beschreibung) <= 2000),
  optionen jsonb not null check (jsonb_typeof(optionen) = 'array' and jsonb_array_length(optionen) between 2 and 10),
  mehrfach boolean not null default false,
  anonym boolean not null default false,
  endet_am timestamptz not null,
  ziele jsonb not null,
  erstellt_von uuid references auth.users(id) on delete set null,
  erstellt_am timestamptz not null default now()
);
create index vereinsumfragen_verein_idx on public.vereinsumfragen (verein_id, erstellt_am desc);

create table public.vereinsumfrage_empfaenger (
  umfrage_id uuid not null references public.vereinsumfragen(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (umfrage_id, user_id)
);
create index vereinsumfrage_empfaenger_user_idx on public.vereinsumfrage_empfaenger (user_id);

-- Stimmen: nie direkt lesbar (auch bei nicht-anonymen Umfragen nur ueber vereinsumfrage_ergebnis)
create table public.vereinsumfrage_stimmen (
  umfrage_id uuid not null references public.vereinsumfragen(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  option smallint not null check (option between 0 and 9),
  abgestimmt_am timestamptz not null default now(),
  primary key (umfrage_id, user_id, option)
);

create or replace function public.darf_umfrage_verwalten(p_umfrage uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select exists (select 1 from vereinsumfragen u where u.id = p_umfrage and (u.erstellt_von = auth.uid() or is_verein_admin(u.verein_id)));
$function$;

alter table public.vereinsumfragen enable row level security;
alter table public.vereinsumfrage_empfaenger enable row level security;
alter table public.vereinsumfrage_stimmen enable row level security;
create policy "Empfaenger und Verantwortliche sehen Umfragen" on public.vereinsumfragen for select to authenticated
  using (verein_hat_lizenz(verein_id) and (
    exists (select 1 from vereinsumfrage_empfaenger e where e.umfrage_id = vereinsumfragen.id and e.user_id = auth.uid())
    or erstellt_von = auth.uid() or is_verein_admin(verein_id)));
create policy "Eigene Umfrage-Zuordnung" on public.vereinsumfrage_empfaenger for select to authenticated using (user_id = auth.uid());
revoke all on table public.vereinsumfragen, public.vereinsumfrage_empfaenger, public.vereinsumfrage_stimmen from public, anon;
grant select on table public.vereinsumfragen, public.vereinsumfrage_empfaenger to authenticated;
grant all on table public.vereinsumfragen, public.vereinsumfrage_empfaenger, public.vereinsumfrage_stimmen to service_role;

create or replace function public.vereinsumfrage_erstellen(p_verein uuid, p_frage text, p_beschreibung text, p_optionen text[],
                                                          p_mehrfach boolean, p_anonym boolean, p_endet_am timestamptz, p_ziele jsonb)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_id uuid;
  v_optionen text[];
begin
  if not darf_news_verfassen(p_verein) then
    raise exception 'Du darfst in diesem Verein keine Umfragen erstellen.' using errcode = '42501';
  end if;
  perform ziele_pruefen(p_verein, p_ziele);
  if btrim(coalesce(p_frage, '')) = '' then raise exception 'Bitte eine Frage angeben.' using errcode = 'P0001'; end if;
  select array_agg(left(btrim(o), 120) order by n) into v_optionen
  from unnest(p_optionen) with ordinality t(o, n) where btrim(coalesce(o, '')) <> '';
  if coalesce(array_length(v_optionen, 1), 0) not between 2 and 10 then
    raise exception 'Bitte 2 bis 10 Antwortmöglichkeiten angeben.' using errcode = 'P0001';
  end if;
  if p_endet_am is null or p_endet_am <= now() or p_endet_am > now() + interval '1 year' then
    raise exception 'Bitte ein Ende in der Zukunft (höchstens ein Jahr) wählen.' using errcode = 'P0001';
  end if;
  insert into vereinsumfragen (verein_id, frage, beschreibung, optionen, mehrfach, anonym, endet_am, ziele, erstellt_von)
  values (p_verein, left(btrim(p_frage), 300), nullif(left(btrim(coalesce(p_beschreibung, '')), 2000), ''), to_jsonb(v_optionen),
          coalesce(p_mehrfach, false), coalesce(p_anonym, false), p_endet_am, p_ziele, auth.uid())
  returning id into v_id;
  insert into vereinsumfrage_empfaenger (umfrage_id, user_id) select v_id, e.user_id from ziel_empfaenger(p_verein, p_ziele) e;
  insert into benachrichtigungen (user_id, typ, text)
  select e.user_id, 'umfrage', 'Neue Umfrage: ' || left(btrim(p_frage), 120)
  from vereinsumfrage_empfaenger e where e.umfrage_id = v_id and e.user_id <> auth.uid();
  return v_id;
end;
$function$;

create or replace function public.vereinsumfrage_abstimmen(p_umfrage uuid, p_optionen integer[])
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  u vereinsumfragen%rowtype;
  v_anzahl int;
begin
  select * into u from vereinsumfragen where id = p_umfrage;
  if u.id is null or not exists (select 1 from vereinsumfrage_empfaenger e where e.umfrage_id = u.id and e.user_id = auth.uid())
     or not verein_hat_lizenz(u.verein_id) then
    raise exception 'Diese Umfrage ist nicht für dich.' using errcode = '42501';
  end if;
  if u.endet_am <= now() then raise exception 'Die Umfrage ist bereits beendet.' using errcode = 'P0001'; end if;
  select count(distinct o) into v_anzahl from unnest(coalesce(p_optionen, '{}')) o;
  if exists (select 1 from unnest(coalesce(p_optionen, '{}')) o where o is null or o < 0 or o >= jsonb_array_length(u.optionen)) then
    raise exception 'Ungültige Antwort.' using errcode = 'P0001';
  end if;
  if not u.mehrfach and v_anzahl > 1 then raise exception 'Bei dieser Umfrage ist nur eine Antwort möglich.' using errcode = 'P0001'; end if;
  delete from vereinsumfrage_stimmen where umfrage_id = u.id and user_id = auth.uid();
  insert into vereinsumfrage_stimmen (umfrage_id, user_id, option)
  select u.id, auth.uid(), o from (select distinct o from unnest(coalesce(p_optionen, '{}')) o) x;
end;
$function$;

create or replace function public.vereinsumfrage_beenden(p_umfrage uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if not darf_umfrage_verwalten(p_umfrage) then raise exception 'Keine Berechtigung.' using errcode = '42501'; end if;
  update vereinsumfragen set endet_am = least(endet_am, now()) where id = p_umfrage;
end;
$function$;

create or replace function public.vereinsumfrage_loeschen(p_umfrage uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if not darf_umfrage_verwalten(p_umfrage) then raise exception 'Keine Berechtigung.' using errcode = '42501'; end if;
  delete from vereinsumfragen where id = p_umfrage;
end;
$function$;

-- Umfragen der angemeldeten Person mit Ergebnis; Namen je Antwort nur fuer Verantwortliche und nur bei nicht-anonymen Umfragen
create or replace function public.meine_vereinsumfragen(p_limit integer default 50)
 returns table(id uuid, verein_id uuid, verein_name text, frage text, beschreibung text, optionen jsonb, mehrfach boolean,
               anonym boolean, endet_am timestamptz, erstellt_am timestamptz, autor text, ist_empfaenger boolean,
               darf_verwalten boolean, empfaenger integer, teilnehmer integer, stimmen jsonb, meine jsonb, namen jsonb)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select u.id, u.verein_id, v.name, u.frage, u.beschreibung, u.optionen, u.mehrfach, u.anonym, u.endet_am, u.erstellt_am,
    (select a.anzeige from anzeige_namen(array[u.erstellt_von]) a),
    me.user_id is not null,
    (u.erstellt_von = auth.uid() or is_verein_admin(u.verein_id)),
    (select count(*)::int from vereinsumfrage_empfaenger e where e.umfrage_id = u.id),
    (select count(distinct s.user_id)::int from vereinsumfrage_stimmen s where s.umfrage_id = u.id),
    (select jsonb_agg((select count(*) from vereinsumfrage_stimmen s where s.umfrage_id = u.id and s.option = i) order by i)
     from generate_series(0, jsonb_array_length(u.optionen) - 1) i),
    (select coalesce(jsonb_agg(s.option order by s.option), '[]'::jsonb) from vereinsumfrage_stimmen s where s.umfrage_id = u.id and s.user_id = auth.uid()),
    case when not u.anonym and (u.erstellt_von = auth.uid() or is_verein_admin(u.verein_id)) then
      (select jsonb_agg(coalesce((select jsonb_agg(a.anzeige order by a.anzeige)
                                  from anzeige_namen(array(select s.user_id from vereinsumfrage_stimmen s where s.umfrage_id = u.id and s.option = i)) a),
                                 '[]'::jsonb) order by i)
       from generate_series(0, jsonb_array_length(u.optionen) - 1) i)
    end
  from vereinsumfragen u
  join vereine v on v.id = u.verein_id
  left join vereinsumfrage_empfaenger me on me.umfrage_id = u.id and me.user_id = auth.uid()
  where verein_hat_lizenz(u.verein_id)
    and (me.user_id is not null or u.erstellt_von = auth.uid() or is_verein_admin(u.verein_id))
  order by (u.endet_am > now()) desc, u.erstellt_am desc
  limit least(greatest(coalesce(p_limit, 50), 1), 200);
$function$;

-- ---------------------------------------------------------------------------------------------
-- TanzRaum-Ankuendigungen der Plattform-Administration (alle Dashboards, unabhaengig von Verein und Tarif)
-- z. B. Wartungsarbeiten, neue Funktionen, Neuigkeiten der Taktmanufaktur
-- ---------------------------------------------------------------------------------------------
create table public.plattform_ankuendigungen (
  id uuid primary key default gen_random_uuid(),
  titel text not null check (char_length(btrim(titel)) between 1 and 150),
  text text not null check (char_length(text) <= 5000),
  art text not null default 'info' check (art in ('info', 'wartung', 'neuheit')),
  wichtig boolean not null default false,
  push boolean not null default false,
  zielgruppe text not null default 'alle' check (zielgruppe in ('alle', 'verantwortliche', 'ab16')),
  sichtbar_ab timestamptz not null default now(),
  sichtbar_bis timestamptz,
  erstellt_von uuid references auth.users(id) on delete set null,
  erstellt_am timestamptz not null default now(),
  check (sichtbar_bis is null or sichtbar_bis > sichtbar_ab)
);
comment on column public.plattform_ankuendigungen.zielgruppe is 'alle | verantwortliche (Vereinsadmins, Trainer, Betreuer) | ab16 (ohne Kinderkonten)';

create table public.plattform_ankuendigung_gelesen (
  ankuendigung_id uuid not null references public.plattform_ankuendigungen(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  gelesen_am timestamptz not null default now(),
  primary key (ankuendigung_id, user_id)
);

create or replace function public.ankuendigung_fuer_mich(a plattform_ankuendigungen)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select auth.uid() is not null and a.sichtbar_ab <= now() and (a.sichtbar_bis is null or a.sichtbar_bis > now())
    and case a.zielgruppe
      when 'alle' then true
      when 'ab16' then not coalesce(ist_unter_16(auth.uid()), true)
      when 'verantwortliche' then exists (
        select 1 from vereins_mitglieder vm join rollen r on r.id = vm.rolle_id
        where vm.user_id = auth.uid() and rolle_familie(r.name) in ('admin', 'trainer', 'betreuer'))
      else false end;
$function$;

alter table public.plattform_ankuendigungen enable row level security;
alter table public.plattform_ankuendigung_gelesen enable row level security;
create policy "Plattformadmin verwaltet Ankuendigungen" on public.plattform_ankuendigungen for all to authenticated
  using (ist_plattform_admin_aktuell()) with check (ist_plattform_admin_aktuell());
create policy "Eigener Lesestatus Ankuendigungen" on public.plattform_ankuendigung_gelesen for select to authenticated using (user_id = auth.uid());
revoke all on table public.plattform_ankuendigungen, public.plattform_ankuendigung_gelesen from public, anon;
grant select, insert, update, delete on table public.plattform_ankuendigungen to authenticated;
grant select on table public.plattform_ankuendigung_gelesen to authenticated;
grant all on table public.plattform_ankuendigungen, public.plattform_ankuendigung_gelesen to service_role;

create or replace function public.ankuendigung_pruefen()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  new.titel := btrim(new.titel);
  new.text := btrim(new.text);
  if tg_op = 'INSERT' then
    new.erstellt_von := auth.uid();
    new.erstellt_am := now();
  end if;
  return new;
end;
$function$;
create trigger ankuendigung_pruefen before insert or update on public.plattform_ankuendigungen
  for each row execute function public.ankuendigung_pruefen();

-- Optionaler Push nach dem Anlegen (ueber die Edge Function chat-push)
create or replace function public.ankuendigung_push_ausloesen()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_geheimnis text;
begin
  if not new.push then return null; end if;
  select decrypted_secret into v_geheimnis from vault.decrypted_secrets where name = 'chat_push_geheimnis';
  if v_geheimnis is null then return null; end if;
  perform net.http_post(
    url := 'https://oraiqjulxmohclfixwdq.supabase.co/functions/v1/chat-push',
    body := jsonb_build_object('ankuendigung_id', new.id),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-tanzraum-geheimnis', v_geheimnis),
    timeout_milliseconds := 5000);
  return null;
exception when others then
  return null; -- Push darf das Anlegen nie verhindern
end;
$function$;
create trigger ankuendigung_push after insert on public.plattform_ankuendigungen
  for each row execute function public.ankuendigung_push_ausloesen();

-- Aktuelle Ankuendigungen fuer das Dashboard (inkl. ob noch zu bestaetigen)
create or replace function public.meine_ankuendigungen()
 returns table(id uuid, titel text, text text, art text, wichtig boolean, sichtbar_ab timestamptz, sichtbar_bis timestamptz, gelesen_am timestamptz)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select a.id, a.titel, a.text, a.art, a.wichtig, a.sichtbar_ab, a.sichtbar_bis, g.gelesen_am
  from plattform_ankuendigungen a
  left join plattform_ankuendigung_gelesen g on g.ankuendigung_id = a.id and g.user_id = auth.uid()
  where ankuendigung_fuer_mich(a)
  order by a.wichtig desc, a.sichtbar_ab desc
  limit 20;
$function$;

create or replace function public.ankuendigung_gelesen(p_ids uuid[])
 returns void
 language sql
 security definer
 set search_path to 'public'
as $function$
  insert into plattform_ankuendigung_gelesen (ankuendigung_id, user_id)
  select a.id, auth.uid() from plattform_ankuendigungen a where a.id = any (p_ids) and ankuendigung_fuer_mich(a)
  on conflict do nothing;
$function$;

-- Verwaltung: Uebersicht mit Anzahl Bestaetigungen
create or replace function public.ankuendigungen_admin()
 returns table(id uuid, titel text, text text, art text, wichtig boolean, push boolean, zielgruppe text, sichtbar_ab timestamptz,
               sichtbar_bis timestamptz, erstellt_am timestamptz, gelesen integer)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select a.id, a.titel, a.text, a.art, a.wichtig, a.push, a.zielgruppe, a.sichtbar_ab, a.sichtbar_bis, a.erstellt_am,
         (select count(*)::int from plattform_ankuendigung_gelesen g where g.ankuendigung_id = a.id)
  from plattform_ankuendigungen a where ist_plattform_admin_aktuell()
  order by a.erstellt_am desc limit 100;
$function$;

-- Push-Ziele (Kategorien wichtige_news/news); nur aktuell sichtbare Ankuendigungen und passende Zielgruppe
create or replace function public.ankuendigung_push_ziele(p_geheimnis text, p_ankuendigung_id uuid)
 returns table(abo_id uuid, endpoint text)
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  a plattform_ankuendigungen%rowtype;
begin
  if not interner_aufruf_ok(p_geheimnis) then
    raise exception 'Nicht berechtigt' using errcode = '42501';
  end if;
  select * into a from plattform_ankuendigungen where id = p_ankuendigung_id;
  if a.id is null or not a.push or a.sichtbar_ab > now() or (a.sichtbar_bis is not null and a.sichtbar_bis <= now()) then return; end if;
  return query
  select ps.id, ps.endpoint from push_subscriptions ps
  where push_kategorie_aktiv(ps.user_id, case when a.wichtig then 'wichtige_news' else 'news' end)
    and ps.user_id is distinct from a.erstellt_von
    and case a.zielgruppe
      when 'alle' then true
      when 'ab16' then not coalesce(ist_unter_16(ps.user_id), true)
      when 'verantwortliche' then exists (
        select 1 from vereins_mitglieder vm join rollen r on r.id = vm.rolle_id
        where vm.user_id = ps.user_id and rolle_familie(r.name) in ('admin', 'trainer', 'betreuer'))
      else false end;
end;
$function$;

-- Vorschau fuer den Service Worker (frische Ankuendigung mit Push)
create or replace function public.meine_push_ankuendigung()
 returns table(id uuid, titel text, wichtig boolean)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select a.id, a.titel, a.wichtig from plattform_ankuendigungen a
  where a.push and a.erstellt_am > now() - interval '3 minutes' and ankuendigung_fuer_mich(a)
    and not exists (select 1 from plattform_ankuendigung_gelesen g where g.ankuendigung_id = a.id and g.user_id = auth.uid())
  order by a.erstellt_am desc limit 1;
$function$;

revoke all on function public.ankuendigung_fuer_mich(plattform_ankuendigungen), public.ankuendigung_pruefen(),
  public.ankuendigung_push_ausloesen(), public.ankuendigung_push_ziele(text, uuid) from public, anon, authenticated;
grant execute on function public.ankuendigung_push_ziele(text, uuid) to service_role;
revoke all on function public.meine_ankuendigungen(), public.ankuendigung_gelesen(uuid[]), public.ankuendigungen_admin(),
  public.meine_push_ankuendigung() from public, anon;
grant execute on function public.meine_ankuendigungen(), public.ankuendigung_gelesen(uuid[]), public.ankuendigungen_admin(),
  public.meine_push_ankuendigung() to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Rechte der Funktionen
-- ---------------------------------------------------------------------------------------------
revoke all on function public.ziel_empfaenger(uuid, jsonb), public.ziele_pruefen(uuid, jsonb), public.news_push_ziele(text, uuid)
  from public, anon, authenticated;
grant execute on function public.news_push_ziele(text, uuid) to service_role;
revoke all on function public.news_rollen_setzen(uuid, text[]), public.news_eigene_gruppen(uuid), public.darf_news_verfassen(uuid),
  public.darf_news_verwalten(uuid), public.news_veroeffentlichen(uuid, text, text, boolean, boolean, jsonb),
  public.news_bearbeiten(uuid, text, text), public.news_loeschen(uuid), public.news_gelesen(uuid[]), public.meine_news(integer),
  public.meine_offenen_wichtigen_news(), public.news_lesestatus(uuid), public.meine_push_news(),
  public.darf_umfrage_verwalten(uuid),
  public.vereinsumfrage_erstellen(uuid, text, text, text[], boolean, boolean, timestamptz, jsonb),
  public.vereinsumfrage_abstimmen(uuid, integer[]), public.vereinsumfrage_beenden(uuid), public.vereinsumfrage_loeschen(uuid),
  public.meine_vereinsumfragen(integer) from public, anon;
grant execute on function public.news_rollen_setzen(uuid, text[]), public.news_eigene_gruppen(uuid), public.darf_news_verfassen(uuid),
  public.darf_news_verwalten(uuid), public.news_veroeffentlichen(uuid, text, text, boolean, boolean, jsonb),
  public.news_bearbeiten(uuid, text, text), public.news_loeschen(uuid), public.news_gelesen(uuid[]), public.meine_news(integer),
  public.meine_offenen_wichtigen_news(), public.news_lesestatus(uuid), public.meine_push_news(),
  public.darf_umfrage_verwalten(uuid),
  public.vereinsumfrage_erstellen(uuid, text, text, text[], boolean, boolean, timestamptz, jsonb),
  public.vereinsumfrage_abstimmen(uuid, integer[]), public.vereinsumfrage_beenden(uuid), public.vereinsumfrage_loeschen(uuid),
  public.meine_vereinsumfragen(integer) to authenticated;
grant execute on function public.rolle_familie(text) to authenticated, service_role;

-- Datenexport um News-Lesestatus, Umfrage-Zuordnungen/-Stimmen und gelesene Ankuendigungen erweitert
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
      ('vereinswechsel_anfragen', 'mitglied_user_id', array[]::text[]), ('konto_loeschungen', 'user_id', array['widerruf_token_hash']),
      ('news_empfaenger', 'user_id', array[]::text[]), ('vereinsumfrage_empfaenger', 'user_id', array[]::text[]),
      ('vereinsumfrage_stimmen', 'user_id', array[]::text[]), ('plattform_ankuendigung_gelesen', 'user_id', array[]::text[])
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

-- Neue Fassung der Datenschutzerklaerung (Abschnitt News, Umfragen und Ankuendigungen)
insert into public.rechtstext_versionen (art, version, gueltig_ab, aenderungshinweis)
values ('datenschutz', '27.09.2026', '2026-09-27', 'Ergänzt: News, Umfragen und TanzRaum-Ankündigungen')
on conflict do nothing;

-- Datenschutz-Kenntnisnahme: jede registrierte Fassung wird mit ihrer Version festgehalten (Uebergang zwischen App-Staenden);
-- die Nutzungsbedingungen muessen weiterhin der aktuellen Fassung entsprechen.
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
  if v_nb is distinct from rechtstext_aktuell('nutzungsbedingungen')
     or not exists (select 1 from rechtstext_versionen r where r.art = 'datenschutz' and r.version = v_ds) then
    raise exception 'Die Nutzungsbedingungen oder die Datenschutzerklärung wurden aktualisiert. Bitte lade die Seite neu.' using errcode = 'P0001';
  end if;
  insert into einwilligungen (user_id, art, version, erteilt, quelle, erteilt_von)
  values (new.id, 'nutzungsbedingungen', v_nb, true, 'registrierung', new.id),
         (new.id, 'datenschutz_kenntnis', v_ds, true, 'registrierung', new.id);
  return new;
end;
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
     or not exists (select 1 from rechtstext_versionen r where r.art = 'datenschutz' and r.version = p_datenschutz) then
    raise exception 'Die Texte wurden aktualisiert. Bitte lade die Seite neu.' using errcode = 'P0001';
  end if;
  perform einwilligung_eintragen(auth.uid(), 'nutzungsbedingungen', p_nutzungsbedingungen, true, 'einstellungen');
  if not exists (select 1 from einwilligungen e where e.user_id = auth.uid() and e.art = 'datenschutz_kenntnis' and e.version = p_datenschutz) then
    perform einwilligung_eintragen(auth.uid(), 'datenschutz_kenntnis', p_datenschutz, true, 'einstellungen');
  end if;
end;
$function$;
