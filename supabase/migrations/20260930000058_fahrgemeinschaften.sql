-- Fahrgemeinschaften (nur Vereinslizenz, immer vereinsintern)
--
-- - Jedes aktive, aufgenommene Mitglied eines Vereins mit gueltiger Vereinslizenz darf Fahrten anbieten oder
--   suchen und auf jede Fahrt reagieren (mitfahren, Fahrt anbieten, Nachricht). Keine Rollenbeschraenkung.
-- - Sichtbar nur fuer Mitglieder desselben Vereins. Keine Ausnahme fuer die Plattform-Administration
--   oder die Fernwartung (keine persoenlichen Inhalte fuer TanzRaum-Admins).
-- - Ohne Vereinszuordnung (Free/Basic) oder ohne Lizenz bzw. bei ausgeschaltetem Bereich: kein Zugriff.
-- - Kinder unter 16 mit Nachrichtensperre durch die Eltern duerfen lesen, aber nichts eintragen.
-- - Schreiben nur ueber die RPCs unten; Tabellen sind fuer angemeldete Personen nur lesbar (RLS).
-- - Benachrichtigung (Glocke + Push-Kategorie "fahrgemeinschaften") an Anbietende bei Reaktionen und an
--   Reagierende bei Absage/Entfernen.
-- - Datensparsamkeit: Fahrten werden 30 Tage nach dem Fahrtdatum automatisch geloescht.

create table if not exists public.fahrgemeinschaften (
  id uuid primary key default gen_random_uuid(),
  verein_id uuid not null references public.vereine(id) on delete cascade,
  erstellt_von uuid not null references public.profiles(id) on delete cascade,
  art text not null check (art in ('angebot', 'gesuch')),
  anlass text not null check (char_length(anlass) between 2 and 120),
  ziel text check (char_length(ziel) <= 150),
  datum date not null,
  uhrzeit time,
  treffpunkt text check (char_length(treffpunkt) <= 150),
  richtung text not null default 'hin_rueck' check (richtung in ('hin', 'rueck', 'hin_rueck')),
  plaetze integer not null default 1 check (plaetze between 1 and 8),
  notiz text check (char_length(notiz) <= 500),
  status text not null default 'offen' check (status in ('offen', 'erledigt', 'abgesagt')),
  erstellt_am timestamptz not null default now(),
  geaendert_am timestamptz not null default now()
);
comment on table public.fahrgemeinschaften is 'Fahrgemeinschaften eines Vereins (Angebot: plaetze = freie Plaetze, Gesuch: plaetze = benoetigte Plaetze)';
create index if not exists fahrgemeinschaften_verein_datum on public.fahrgemeinschaften (verein_id, datum);
create index if not exists fahrgemeinschaften_erstellt_von on public.fahrgemeinschaften (erstellt_von);

create table if not exists public.fahrgemeinschaft_antworten (
  id uuid primary key default gen_random_uuid(),
  fahrt_id uuid not null references public.fahrgemeinschaften(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  art text not null check (art in ('mitfahren', 'anbieten', 'nachricht')),
  personen integer not null default 1 check (personen between 1 and 8),
  text text check (char_length(text) <= 300),
  erstellt_am timestamptz not null default now()
);
create unique index if not exists fahrgemeinschaft_antworten_einmal
  on public.fahrgemeinschaft_antworten (fahrt_id, user_id) where art in ('mitfahren', 'anbieten');
create index if not exists fahrgemeinschaft_antworten_fahrt on public.fahrgemeinschaft_antworten (fahrt_id);
create index if not exists fahrgemeinschaft_antworten_user on public.fahrgemeinschaft_antworten (user_id);

-- Zugang: aktives, aufgenommenes Mitglied + Vereinslizenz + Bereich nicht ausgeschaltet
create or replace function public.fahrgemeinschaft_zugang(p_verein_id uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select auth.uid() is not null
    and exists (select 1 from vereins_mitglieder vm
                where vm.verein_id = p_verein_id and vm.user_id = auth.uid()
                  and coalesce(vm.aktiv, true) and vm.aufnahme_status = 'aufgenommen')
    and verein_hat_lizenz(p_verein_id)
    and not exists (select 1 from vereine v where v.id = p_verein_id and 'fahrgemeinschaften' = any(v.module_aus));
$function$;

-- Aktives Mitglied (fuer Anzeige: Eintraege ausgetretener Personen werden ausgeblendet)
create or replace function public.fahrgemeinschaft_mitglied(p_verein_id uuid, p_user uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select exists (select 1 from vereins_mitglieder vm
                 where vm.verein_id = p_verein_id and vm.user_id = p_user
                   and coalesce(vm.aktiv, true) and vm.aufnahme_status = 'aufgenommen');
$function$;

alter table public.fahrgemeinschaften enable row level security;
alter table public.fahrgemeinschaft_antworten enable row level security;
drop policy if exists "Vereinsmitglieder sehen Fahrgemeinschaften" on public.fahrgemeinschaften;
create policy "Vereinsmitglieder sehen Fahrgemeinschaften" on public.fahrgemeinschaften for select to authenticated
  using (fahrgemeinschaft_zugang(verein_id));
drop policy if exists "Vereinsmitglieder sehen Antworten" on public.fahrgemeinschaft_antworten;
create policy "Vereinsmitglieder sehen Antworten" on public.fahrgemeinschaft_antworten for select to authenticated
  using (exists (select 1 from fahrgemeinschaften f where f.id = fahrt_id and fahrgemeinschaft_zugang(f.verein_id)));
revoke all on public.fahrgemeinschaften, public.fahrgemeinschaft_antworten from public, anon, authenticated;
grant select on public.fahrgemeinschaften, public.fahrgemeinschaft_antworten to authenticated;
grant all on public.fahrgemeinschaften, public.fahrgemeinschaft_antworten to service_role;

-- Eigener Verein mit Zugang (eine Person ist in genau einem Verein)
create or replace function public.fahrgemeinschaft_mein_verein()
 returns uuid
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select vm.verein_id from vereins_mitglieder vm
  where vm.user_id = auth.uid() and coalesce(vm.aktiv, true) and vm.aufnahme_status = 'aufgenommen'
  order by fahrgemeinschaft_zugang(vm.verein_id) desc, vm.created_at
  limit 1;
$function$;

create or replace function public.fahrgemeinschaft_name(p_user uuid)
 returns text
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select coalesce(nullif(trim(coalesce(p.vorname, '') || ' ' || coalesce(p.nachname, '')), ''), 'Mitglied')
  from profiles p where p.id = p_user;
$function$;

create or replace function public.fahrgemeinschaft_heute()
 returns date
 language sql
 stable
 set search_path to 'public'
as $function$
  select (now() at time zone 'Europe/Berlin')::date;
$function$;

-- Benachrichtigung (Glocke); Push uebernimmt der Trigger auf benachrichtigungen
create or replace function public.fahrgemeinschaft_benachrichtigen(p_user uuid, p_text text)
 returns void
 language sql
 security definer
 set search_path to 'public'
as $function$
  insert into benachrichtigungen (user_id, typ, text)
  select p_user, 'fahrgemeinschaft', left(p_text, 300)
  where p_user is not null and p_user is distinct from auth.uid();
$function$;

create or replace function public.fahrgemeinschaft_kurz(f public.fahrgemeinschaften)
 returns text
 language sql
 stable
 set search_path to 'public'
as $function$
  select f.anlass || ' am ' || to_char(f.datum, 'DD.MM.');
$function$;

-- Uebersicht fuer die Seite: Zugang, eigener Verein, Fahrten mit Antworten
create or replace function public.fahrgemeinschaften_uebersicht(p_vergangene boolean default false)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  v_user uuid := auth.uid();
  v_verein uuid := fahrgemeinschaft_mein_verein();
  v_heute date := fahrgemeinschaft_heute();
begin
  if v_user is null then
    raise exception 'Nicht angemeldet.' using errcode = '42501';
  end if;
  if v_verein is null then
    return jsonb_build_object('zugang', false, 'grund', 'kein_verein');
  end if;
  if not verein_hat_lizenz(v_verein) then
    return jsonb_build_object('zugang', false, 'grund', 'keine_lizenz');
  end if;
  if not fahrgemeinschaft_zugang(v_verein) then
    return jsonb_build_object('zugang', false, 'grund', 'bereich_aus');
  end if;

  return jsonb_build_object(
    'zugang', true,
    'verein_id', v_verein,
    'verein_name', (select v.name from vereine v where v.id = v_verein),
    'ich', v_user,
    'darf_schreiben', not coalesce(eltern_nachrichtensperre(v_user), false),
    'fahrten', coalesce((
      select jsonb_agg(x.j order by x.datum, x.uhrzeit nulls first, x.erstellt_am)
      from (
        select f.datum, f.uhrzeit, f.erstellt_am, jsonb_build_object(
          'id', f.id, 'art', f.art, 'anlass', f.anlass, 'ziel', f.ziel, 'datum', f.datum, 'uhrzeit', to_char(f.uhrzeit, 'HH24:MI'),
          'treffpunkt', f.treffpunkt, 'richtung', f.richtung, 'plaetze', f.plaetze, 'notiz', f.notiz, 'status', f.status,
          'erstellt_am', f.erstellt_am,
          'ersteller', jsonb_build_object('id', f.erstellt_von, 'name', fahrgemeinschaft_name(f.erstellt_von),
                                          'avatar_url', (select p.avatar_url from profiles p where p.id = f.erstellt_von)),
          'ist_meine', f.erstellt_von = v_user,
          'belegt', coalesce((select sum(a.personen) from fahrgemeinschaft_antworten a
                              where a.fahrt_id = f.id and a.art = 'mitfahren' and fahrgemeinschaft_mitglied(f.verein_id, a.user_id)), 0),
          'angeboten', coalesce((select sum(a.personen) from fahrgemeinschaft_antworten a
                                 where a.fahrt_id = f.id and a.art = 'anbieten' and fahrgemeinschaft_mitglied(f.verein_id, a.user_id)), 0),
          'antworten', coalesce((
            select jsonb_agg(jsonb_build_object(
              'id', a.id, 'art', a.art, 'personen', a.personen, 'text', a.text, 'erstellt_am', a.erstellt_am,
              'user_id', a.user_id, 'name', fahrgemeinschaft_name(a.user_id),
              'avatar_url', (select p.avatar_url from profiles p where p.id = a.user_id),
              'ist_meine', a.user_id = v_user) order by a.erstellt_am)
            from fahrgemeinschaft_antworten a
            where a.fahrt_id = f.id and fahrgemeinschaft_mitglied(f.verein_id, a.user_id)), '[]'::jsonb)
        ) as j
        from fahrgemeinschaften f
        where f.verein_id = v_verein
          and fahrgemeinschaft_mitglied(f.verein_id, f.erstellt_von)
          and case when p_vergangene then f.datum < v_heute else f.datum >= v_heute end
        order by f.datum, f.uhrzeit nulls first
        limit 200
      ) x), '[]'::jsonb)
  );
end;
$function$;

-- Anlegen oder (nur eigene) bearbeiten
create or replace function public.fahrgemeinschaft_speichern(
  p_id uuid, p_art text, p_anlass text, p_ziel text, p_datum date, p_uhrzeit time,
  p_treffpunkt text, p_richtung text, p_plaetze integer, p_notiz text)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_user uuid := auth.uid();
  v_verein uuid;
  v_alt fahrgemeinschaften%rowtype;
  v_belegt integer;
  v_id uuid;
  v_heute date := fahrgemeinschaft_heute();
begin
  if p_id is null then
    v_verein := fahrgemeinschaft_mein_verein();
  else
    select * into v_alt from fahrgemeinschaften where id = p_id for update;
    if v_alt.id is null or v_alt.erstellt_von is distinct from v_user then
      raise exception 'Nur wer die Fahrt eingetragen hat, kann sie bearbeiten.' using errcode = '42501';
    end if;
    v_verein := v_alt.verein_id;
  end if;
  if v_verein is null or not fahrgemeinschaft_zugang(v_verein) then
    raise exception 'Fahrgemeinschaften gibt es nur innerhalb eines Vereins mit Vereinslizenz.' using errcode = '42501';
  end if;
  if coalesce(eltern_nachrichtensperre(v_user), false) then
    raise exception 'Deine Eltern haben Nachrichten ausgeschaltet. Bitte frag sie, ob sie die Fahrt für dich eintragen.' using errcode = '42501';
  end if;
  if p_art not in ('angebot', 'gesuch') then raise exception 'Bitte wähle Angebot oder Gesuch.' using errcode = 'P0001'; end if;
  if char_length(trim(coalesce(p_anlass, ''))) < 2 then raise exception 'Bitte gib an, wohin bzw. zu welchem Anlass.' using errcode = 'P0001'; end if;
  if p_datum is null or p_datum < v_heute or p_datum > v_heute + 365 then
    raise exception 'Bitte wähle ein Datum zwischen heute und in einem Jahr.' using errcode = 'P0001';
  end if;
  if coalesce(p_richtung, 'hin_rueck') not in ('hin', 'rueck', 'hin_rueck') then raise exception 'Ungültige Richtung.' using errcode = 'P0001'; end if;
  if p_plaetze is null or p_plaetze not between 1 and 8 then raise exception 'Bitte 1 bis 8 Plätze angeben.' using errcode = 'P0001'; end if;

  if p_id is null then
    if (select count(*) from fahrgemeinschaften f where f.erstellt_von = v_user and f.datum >= v_heute and f.status = 'offen') >= 15 then
      raise exception 'Du hast schon 15 offene Fahrten eingetragen.' using errcode = 'P0001';
    end if;
    insert into fahrgemeinschaften (verein_id, erstellt_von, art, anlass, ziel, datum, uhrzeit, treffpunkt, richtung, plaetze, notiz)
    values (v_verein, v_user, p_art, trim(p_anlass), nullif(trim(p_ziel), ''), p_datum, p_uhrzeit, nullif(trim(p_treffpunkt), ''),
            coalesce(p_richtung, 'hin_rueck'), p_plaetze, nullif(trim(p_notiz), ''))
    returning id into v_id;
    return v_id;
  end if;

  if v_alt.art = 'angebot' then
    select coalesce(sum(personen), 0) into v_belegt from fahrgemeinschaft_antworten where fahrt_id = p_id and art = 'mitfahren';
    if p_plaetze < v_belegt then
      raise exception 'Es fahren schon % Personen mit. Entferne zuerst Mitfahrende oder lass mehr Plätze frei.', v_belegt using errcode = 'P0001';
    end if;
  end if;
  update fahrgemeinschaften set
    art = case when exists (select 1 from fahrgemeinschaft_antworten a where a.fahrt_id = p_id and a.art <> 'nachricht') then art else p_art end,
    anlass = trim(p_anlass), ziel = nullif(trim(p_ziel), ''), datum = p_datum, uhrzeit = p_uhrzeit,
    treffpunkt = nullif(trim(p_treffpunkt), ''), richtung = coalesce(p_richtung, 'hin_rueck'), plaetze = p_plaetze,
    notiz = nullif(trim(p_notiz), ''), geaendert_am = now()
  where id = p_id;
  -- Mitfahrende ueber Aenderungen von Datum/Uhrzeit/Treffpunkt informieren
  if v_alt.datum is distinct from p_datum or v_alt.uhrzeit is distinct from p_uhrzeit
     or v_alt.treffpunkt is distinct from nullif(trim(p_treffpunkt), '') then
    perform fahrgemeinschaft_benachrichtigen(a.user_id,
      'Fahrgemeinschaft geändert: ' || trim(p_anlass) || ' am ' || to_char(p_datum, 'DD.MM.')
      || coalesce(' um ' || to_char(p_uhrzeit, 'HH24:MI') || ' Uhr', '') || coalesce(' · Treffpunkt: ' || nullif(trim(p_treffpunkt), ''), ''))
    from (select distinct user_id from fahrgemeinschaft_antworten where fahrt_id = p_id and art <> 'nachricht') a;
  end if;
  return p_id;
end;
$function$;

-- Status aendern (nur eigene): offen / erledigt (voll bzw. gefunden) / abgesagt
create or replace function public.fahrgemeinschaft_status_setzen(p_id uuid, p_status text)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  f fahrgemeinschaften%rowtype;
begin
  select * into f from fahrgemeinschaften where id = p_id for update;
  if f.id is null or f.erstellt_von is distinct from auth.uid() or not fahrgemeinschaft_zugang(f.verein_id) then
    raise exception 'Nur wer die Fahrt eingetragen hat, kann den Status ändern.' using errcode = '42501';
  end if;
  if p_status not in ('offen', 'erledigt', 'abgesagt') then raise exception 'Ungültiger Status.' using errcode = 'P0001'; end if;
  update fahrgemeinschaften set status = p_status, geaendert_am = now() where id = p_id;
  if p_status = 'abgesagt' and f.status <> 'abgesagt' then
    perform fahrgemeinschaft_benachrichtigen(a.user_id,
      fahrgemeinschaft_name(f.erstellt_von) || ' hat die Fahrgemeinschaft abgesagt: ' || fahrgemeinschaft_kurz(f))
    from (select distinct user_id from fahrgemeinschaft_antworten where fahrt_id = p_id and art <> 'nachricht') a;
  end if;
end;
$function$;

-- Loeschen (nur eigene); Mitfahrende werden informiert, wenn die Fahrt noch bevorsteht
create or replace function public.fahrgemeinschaft_loeschen(p_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  f fahrgemeinschaften%rowtype;
begin
  select * into f from fahrgemeinschaften where id = p_id for update;
  if f.id is null or f.erstellt_von is distinct from auth.uid() then
    raise exception 'Nur wer die Fahrt eingetragen hat, kann sie löschen.' using errcode = '42501';
  end if;
  if f.datum >= fahrgemeinschaft_heute() and f.status <> 'abgesagt' then
    perform fahrgemeinschaft_benachrichtigen(a.user_id,
      fahrgemeinschaft_name(f.erstellt_von) || ' hat die Fahrgemeinschaft zurückgezogen: ' || fahrgemeinschaft_kurz(f))
    from (select distinct user_id from fahrgemeinschaft_antworten where fahrt_id = p_id and art <> 'nachricht') a;
  end if;
  delete from fahrgemeinschaften where id = p_id;
end;
$function$;

-- Reagieren: jedes berechtigte Vereinsmitglied (mitfahren bei Angebot, Fahrt anbieten bei Gesuch, Nachricht bei beidem)
create or replace function public.fahrgemeinschaft_reagieren(p_fahrt_id uuid, p_art text, p_personen integer, p_text text)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_user uuid := auth.uid();
  f fahrgemeinschaften%rowtype;
  v_belegt integer;
  v_id uuid;
  v_personen integer := coalesce(p_personen, 1);
  v_text text := nullif(trim(coalesce(p_text, '')), '');
  v_name text;
begin
  select * into f from fahrgemeinschaften where id = p_fahrt_id for update;
  if f.id is null or not fahrgemeinschaft_zugang(f.verein_id) or not fahrgemeinschaft_mitglied(f.verein_id, f.erstellt_von) then
    raise exception 'Diese Fahrgemeinschaft ist nicht verfügbar.' using errcode = '42501';
  end if;
  if coalesce(eltern_nachrichtensperre(v_user), false) then
    raise exception 'Deine Eltern haben Nachrichten ausgeschaltet. Bitte frag sie, ob sie dich eintragen.' using errcode = '42501';
  end if;
  if f.status <> 'offen' or f.datum < fahrgemeinschaft_heute() then
    raise exception 'Diese Fahrgemeinschaft ist nicht mehr offen.' using errcode = 'P0001';
  end if;
  if p_art not in ('mitfahren', 'anbieten', 'nachricht') then raise exception 'Ungültige Reaktion.' using errcode = 'P0001'; end if;
  if v_text is not null and char_length(v_text) > 300 then raise exception 'Bitte höchstens 300 Zeichen.' using errcode = 'P0001'; end if;
  if v_personen not between 1 and 8 then raise exception 'Bitte 1 bis 8 Personen angeben.' using errcode = 'P0001'; end if;
  if (select count(*) from fahrgemeinschaft_antworten a where a.user_id = v_user and a.erstellt_am > now() - interval '1 hour') >= 30 then
    raise exception 'Bitte warte kurz, bevor du weitere Reaktionen schickst.' using errcode = 'P0001';
  end if;
  v_name := fahrgemeinschaft_name(v_user);

  if p_art = 'nachricht' then
    if v_text is null then raise exception 'Bitte schreib eine Nachricht.' using errcode = 'P0001'; end if;
    insert into fahrgemeinschaft_antworten (fahrt_id, user_id, art, personen, text) values (p_fahrt_id, v_user, 'nachricht', 1, v_text)
    returning id into v_id;
    if v_user = f.erstellt_von then
      perform fahrgemeinschaft_benachrichtigen(a.user_id, v_name || ' zu ' || fahrgemeinschaft_kurz(f) || ': ' || v_text)
      from (select distinct user_id from fahrgemeinschaft_antworten where fahrt_id = p_fahrt_id and art <> 'nachricht') a;
    else
      perform fahrgemeinschaft_benachrichtigen(f.erstellt_von, v_name || ' zu ' || fahrgemeinschaft_kurz(f) || ': ' || v_text);
    end if;
    return v_id;
  end if;

  if v_user = f.erstellt_von then
    raise exception 'Auf die eigene Fahrt kannst du nur mit einer Nachricht reagieren.' using errcode = 'P0001';
  end if;
  if p_art = 'mitfahren' and f.art <> 'angebot' then
    raise exception 'Mitfahren geht nur bei einem Fahrtangebot.' using errcode = 'P0001';
  end if;
  if p_art = 'anbieten' and f.art <> 'gesuch' then
    raise exception 'Eine Fahrt anbieten kannst du bei einem Gesuch.' using errcode = 'P0001';
  end if;
  if p_art = 'mitfahren' then
    select coalesce(sum(a.personen), 0) into v_belegt from fahrgemeinschaft_antworten a
    where a.fahrt_id = p_fahrt_id and a.art = 'mitfahren' and a.user_id <> v_user;
    if v_belegt + v_personen > f.plaetze then
      raise exception '%', case when f.plaetze - v_belegt <= 0 then 'Diese Fahrt ist leider schon voll.'
                                 when f.plaetze - v_belegt = 1 then 'Es ist nur noch 1 Platz frei.'
                                 else 'Es sind nur noch ' || (f.plaetze - v_belegt) || ' Plätze frei.' end using errcode = 'P0001';
    end if;
  end if;

  insert into fahrgemeinschaft_antworten (fahrt_id, user_id, art, personen, text)
  values (p_fahrt_id, v_user, p_art, v_personen, v_text)
  on conflict (fahrt_id, user_id) where art in ('mitfahren', 'anbieten')
  do update set personen = excluded.personen, text = excluded.text, erstellt_am = now()
  returning id into v_id;

  perform fahrgemeinschaft_benachrichtigen(f.erstellt_von,
    case p_art
      when 'mitfahren' then v_name || ' möchte mitfahren' || case when v_personen > 1 then ' (' || v_personen || ' Personen)' else '' end
      else v_name || ' kann dich mitnehmen' || case when v_personen > 1 then ' (' || v_personen || ' Plätze)' else '' end
    end || ': ' || fahrgemeinschaft_kurz(f) || coalesce(' – „' || v_text || '“', ''));
  return v_id;
end;
$function$;

-- Reaktion entfernen: eigene jederzeit; wer die Fahrt eingetragen hat, darf Reaktionen auf seiner Fahrt entfernen
create or replace function public.fahrgemeinschaft_reaktion_entfernen(p_antwort_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  a fahrgemeinschaft_antworten%rowtype;
  f fahrgemeinschaften%rowtype;
begin
  select * into a from fahrgemeinschaft_antworten where id = p_antwort_id;
  select * into f from fahrgemeinschaften where id = a.fahrt_id;
  if a.id is null or not fahrgemeinschaft_zugang(f.verein_id)
     or (a.user_id is distinct from auth.uid() and f.erstellt_von is distinct from auth.uid()) then
    raise exception 'Diese Reaktion kannst du nicht entfernen.' using errcode = '42501';
  end if;
  delete from fahrgemeinschaft_antworten where id = p_antwort_id;
  if a.art <> 'nachricht' and f.datum >= fahrgemeinschaft_heute() then
    if a.user_id = auth.uid() then
      perform fahrgemeinschaft_benachrichtigen(f.erstellt_von,
        fahrgemeinschaft_name(a.user_id) || case when a.art = 'mitfahren' then ' fährt doch nicht mit: ' else ' kann doch nicht fahren: ' end
        || fahrgemeinschaft_kurz(f));
    else
      perform fahrgemeinschaft_benachrichtigen(a.user_id,
        fahrgemeinschaft_name(f.erstellt_von) || ' hat deinen Eintrag bei der Fahrgemeinschaft entfernt: ' || fahrgemeinschaft_kurz(f));
    end if;
  end if;
end;
$function$;

-- Aufraeumen: 30 Tage nach dem Fahrtdatum loeschen (Datensparsamkeit)
create or replace function public.fahrgemeinschaften_aufraeumen()
 returns integer
 language sql
 security definer
 set search_path to 'public'
as $function$
  with weg as (delete from fahrgemeinschaften where datum < fahrgemeinschaft_heute() - 30 returning 1)
  select count(*)::integer from weg;
$function$;

revoke execute on function public.fahrgemeinschaft_zugang(uuid), public.fahrgemeinschaft_mitglied(uuid, uuid),
  public.fahrgemeinschaft_mein_verein(), public.fahrgemeinschaft_name(uuid), public.fahrgemeinschaft_benachrichtigen(uuid, text),
  public.fahrgemeinschaft_kurz(public.fahrgemeinschaften), public.fahrgemeinschaften_uebersicht(boolean),
  public.fahrgemeinschaft_speichern(uuid, text, text, text, date, time, text, text, integer, text),
  public.fahrgemeinschaft_status_setzen(uuid, text), public.fahrgemeinschaft_loeschen(uuid),
  public.fahrgemeinschaft_reagieren(uuid, text, integer, text), public.fahrgemeinschaft_reaktion_entfernen(uuid),
  public.fahrgemeinschaften_aufraeumen(), public.fahrgemeinschaft_heute() from public, anon;
revoke execute on function public.fahrgemeinschaft_benachrichtigen(uuid, text), public.fahrgemeinschaften_aufraeumen(),
  public.fahrgemeinschaft_mein_verein(), public.fahrgemeinschaft_mitglied(uuid, uuid), public.fahrgemeinschaft_name(uuid) from authenticated;
grant execute on function public.fahrgemeinschaft_zugang(uuid), public.fahrgemeinschaft_heute(),
  public.fahrgemeinschaften_uebersicht(boolean),
  public.fahrgemeinschaft_speichern(uuid, text, text, text, date, time, text, text, integer, text),
  public.fahrgemeinschaft_status_setzen(uuid, text), public.fahrgemeinschaft_loeschen(uuid),
  public.fahrgemeinschaft_reagieren(uuid, text, integer, text), public.fahrgemeinschaft_reaktion_entfernen(uuid) to authenticated;

do $cron$
begin
  perform cron.unschedule('fahrgemeinschaften-aufraeumen') where exists (select 1 from cron.job where jobname = 'fahrgemeinschaften-aufraeumen');
  perform cron.schedule('fahrgemeinschaften-aufraeumen', '25 4 * * *', 'select public.fahrgemeinschaften_aufraeumen()');
end
$cron$;

-- ---------------------------------------------------------------------------------------------
-- Rechte: Fahrgemeinschaften stehen immer allen Mitgliedern offen (nicht mehr per Rolle einschraenkbar)
-- ---------------------------------------------------------------------------------------------
do $mig$
declare
  d text := pg_get_functiondef('public.meine_bereiche()'::regprocedure);
  alt text := $o$where m.typ = 'admin' or m.typ = any(bereich_rollen(m.verein_id, z.bereich));$o$;
  neu text := $n$where m.typ = 'admin' or z.bereich = 'fahrgemeinschaften' or m.typ = any(bereich_rollen(m.verein_id, z.bereich));$n$;
begin
  if position(alt in d) = 0 then
    raise exception 'meine_bereiche: erwarteter Ausdruck nicht gefunden';
  end if;
  execute replace(d, alt, neu);

  d := pg_get_functiondef('public.verein_bereich_zugang_setzen(uuid, text, text[])'::regprocedure);
  alt := $o$  if p_bereich not in ('fahrgemeinschaften', 'kostueme', 'finanzen', 'statistiken') then$o$;
  neu := $n$  if p_bereich = 'fahrgemeinschaften' then
    raise exception 'Fahrgemeinschaften stehen immer allen Vereinsmitgliedern offen.' using errcode = 'P0001';
  end if;
  if p_bereich not in ('kostueme', 'finanzen', 'statistiken') then$n$;
  if position(alt in d) = 0 then
    raise exception 'verein_bereich_zugang_setzen: erwarteter Ausdruck nicht gefunden';
  end if;
  execute replace(d, alt, neu);

  -- Datenexport: eigene Fahrten und Reaktionen
  d := pg_get_functiondef('public.meine_daten_export()'::regprocedure);
  alt := $o$('plattform_ankuendigung_gelesen', 'user_id', array[]::text[])$o$;
  neu := $n$('plattform_ankuendigung_gelesen', 'user_id', array[]::text[]),
      ('fahrgemeinschaften', 'erstellt_von', array[]::text[]), ('fahrgemeinschaft_antworten', 'user_id', array[]::text[])$n$;
  if position(alt in d) = 0 then
    raise exception 'meine_daten_export: erwarteter Ausdruck nicht gefunden';
  end if;
  execute replace(d, alt, neu);
end
$mig$;
-- Alte Rollen-Einstellungen fuer Fahrgemeinschaften bleiben gespeichert, werden aber nicht mehr ausgewertet.

-- ---------------------------------------------------------------------------------------------
-- Push-Kategorie "fahrgemeinschaften" (Standard an) + Push fuer Fahrgemeinschafts-Benachrichtigungen
-- ---------------------------------------------------------------------------------------------
alter table public.push_einstellungen drop constraint if exists push_einstellungen_kategorie_check;
alter table public.push_einstellungen add constraint push_einstellungen_kategorie_check
  check (kategorie in ('chat', 'anrufe', 'training', 'trainingsaenderung', 'abmeldung', 'news', 'wichtige_news', 'turniere', 'fahrgemeinschaften'));

create or replace function public.push_kategorie_standard(p_kategorie text)
 returns boolean
 language sql
 immutable
 set search_path to 'public'
as $function$
  select p_kategorie in ('chat', 'anrufe', 'trainingsaenderung', 'wichtige_news', 'fahrgemeinschaften');
$function$;

create or replace function public.fahrgemeinschaft_push_ausloesen()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_geheimnis text;
begin
  if new.typ <> 'fahrgemeinschaft' then return null; end if;
  select decrypted_secret into v_geheimnis from vault.decrypted_secrets where name = 'chat_push_geheimnis';
  if v_geheimnis is null then return null; end if;
  perform net.http_post(
    url := 'https://oraiqjulxmohclfixwdq.supabase.co/functions/v1/chat-push',
    body := jsonb_build_object('benachrichtigung_id', new.id),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-tanzraum-geheimnis', v_geheimnis),
    timeout_milliseconds := 5000);
  return null;
exception when others then
  return null; -- Push darf das Anlegen nie verhindern
end;
$function$;

drop trigger if exists fahrgemeinschaft_push on public.benachrichtigungen;
create trigger fahrgemeinschaft_push after insert on public.benachrichtigungen
  for each row when (new.typ = 'fahrgemeinschaft') execute function public.fahrgemeinschaft_push_ausloesen();

create or replace function public.benachrichtigung_push_ziele(p_geheimnis text, p_benachrichtigung_id uuid)
 returns table(abo_id uuid, endpoint text)
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  b benachrichtigungen%rowtype;
begin
  if not interner_aufruf_ok(p_geheimnis) then
    raise exception 'Nicht berechtigt' using errcode = '42501';
  end if;
  select * into b from benachrichtigungen where id = p_benachrichtigung_id;
  if b.id is null or b.typ <> 'fahrgemeinschaft' or b.gelesen or b.erstellt_am < now() - interval '10 minutes' then return; end if;
  return query
  select ps.id, ps.endpoint from push_subscriptions ps
  where ps.user_id = b.user_id
    and push_erlaubt(ps.user_id)
    and push_kategorie_aktiv(ps.user_id, 'fahrgemeinschaften');
end;
$function$;

-- Fuer den Service Worker (push-info): neueste ungelesene Fahrgemeinschafts-Benachrichtigung der letzten Minuten
create or replace function public.meine_push_fahrgemeinschaft()
 returns table(id uuid, text text)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select b.id, b.text from benachrichtigungen b
  where b.user_id = auth.uid() and b.typ = 'fahrgemeinschaft' and not b.gelesen and b.erstellt_am > now() - interval '3 minutes'
  order by b.erstellt_am desc limit 1;
$function$;

revoke execute on function public.fahrgemeinschaft_push_ausloesen(), public.benachrichtigung_push_ziele(text, uuid),
  public.meine_push_fahrgemeinschaft() from public, anon;
revoke execute on function public.fahrgemeinschaft_push_ausloesen(), public.benachrichtigung_push_ziele(text, uuid) from authenticated;
grant execute on function public.benachrichtigung_push_ziele(text, uuid) to service_role;
grant execute on function public.meine_push_fahrgemeinschaft() to authenticated;
