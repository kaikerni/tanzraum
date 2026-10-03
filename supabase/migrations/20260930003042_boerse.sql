-- TanzRaum Boerse: Community-Marktplatz (kaufen, verkaufen, tauschen, verschenken, suchen) fuer ALLE angemeldeten
-- Personen (FREE, BASIC, VEREIN) – ausdruecklich keine Vereinsfunktion, keine Verbindung zur Vereinsverwaltung.
--
-- - Keine Zahlungsabwicklung: TanzRaum vermittelt nur den Kontakt (TanzRaum-Chat).
-- - Datenschutz: Ort nur als Ortsname/Region (optional Ortsmitte, auf ~1 km gerundet, fuer „in meiner Naehe“);
--   keine Telefonnummer/E-Mail/Adresse; Bilder im privaten Bucket, Anzeige nur angemeldet ueber signierte Links.
-- - Jugendschutz: unter 16 nur ansehen und merken – kein eigenes Angebot, kein Kontakt; Elternsperre, Blockierung
--   und Sperren gelten. Kontakt ueber die Boerse erlaubt Nachrichten (nicht Anrufe) zwischen Personen ab 16,
--   auch ohne Kontaktanfrage und auch mit FREE – nur fuer Gespraeche, die ueber ein Angebot entstanden sind.
-- - Moderation: Meldungen, Sperren/Loeschen von Angeboten, Boerse-Sperre fuer Personen (nur Boerse).
--   Die Administration sieht dafuer Angebote und Meldegruende – keine Vereins- oder Mitgliederdaten.

-- ---------------------------------------------------------------------------------------------
-- Kategorien (erweiterbar, mit Unterkategorien)
-- ---------------------------------------------------------------------------------------------
create table if not exists public.boerse_kategorien (
  schluessel text primary key check (schluessel ~ '^[a-z0-9_]{2,40}$'),
  eltern text references public.boerse_kategorien(schluessel) on delete cascade,
  name text not null check (char_length(name) between 2 and 60),
  emoji text,
  sortierung integer not null default 100,
  aktiv boolean not null default true
);
alter table public.boerse_kategorien enable row level security;
drop policy if exists "Kategorien lesen" on public.boerse_kategorien;
create policy "Kategorien lesen" on public.boerse_kategorien for select to authenticated, anon using (aktiv);
revoke all on public.boerse_kategorien from public, anon, authenticated;
grant select on public.boerse_kategorien to anon, authenticated;

insert into public.boerse_kategorien (schluessel, eltern, name, emoji, sortierung) values
  ('kostueme', null, 'Kostüme', '👗', 10),
  ('tanzschuhe', null, 'Tanzschuhe', '👠', 20),
  ('accessoires', null, 'Accessoires', '🎀', 30),
  ('requisiten', null, 'Requisiten', '🎭', 40),
  ('trainingsbekleidung', null, 'Trainingsbekleidung', '👕', 50),
  ('zubehoer', null, 'Tanzsport-Zubehör', '🧳', 60),
  ('sonstiges', null, 'Sonstiges', '📦', 90),
  ('gardekostuem', 'kostueme', 'Gardekostüm', null, 11),
  ('mariechenkostuem', 'kostueme', 'Mariechen-/Solokostüm', null, 12),
  ('schautanzkostuem', 'kostueme', 'Schautanz-/Showtanzkostüm', null, 13),
  ('tanzpaarkostuem', 'kostueme', 'Tanzpaar-Kostüm', null, 14),
  ('kostuem_set', 'kostueme', 'Gruppen-/Kostüm-Set', null, 15),
  ('gardestiefel', 'tanzschuhe', 'Gardestiefel', null, 21),
  ('tanzschuhe_allg', 'tanzschuhe', 'Tanz-/Trainingsschuhe', null, 22),
  ('kopfbedeckung', 'accessoires', 'Hut / Dreispitz / Kopfschmuck', null, 31),
  ('peruecke', 'accessoires', 'Perücke / Haarteil', null, 32),
  ('handschuhe', 'accessoires', 'Handschuhe', null, 33),
  ('schmuck', 'accessoires', 'Schmuck / Orden', null, 34),
  ('buehnenrequisit', 'requisiten', 'Bühnenrequisit', null, 41),
  ('handrequisit', 'requisiten', 'Handrequisit', null, 42),
  ('trainingsanzug', 'trainingsbekleidung', 'Trainingsanzug / Jacke', null, 51),
  ('trainingskleidung', 'trainingsbekleidung', 'Trikot / Shirt / Hose', null, 52),
  ('taschen', 'zubehoer', 'Kostümtaschen / Koffer', null, 61),
  ('schminke', 'zubehoer', 'Schminke / Pflege', null, 62)
on conflict (schluessel) do nothing;

-- ---------------------------------------------------------------------------------------------
-- Angebote
-- ---------------------------------------------------------------------------------------------
create table if not exists public.boerse_angebote (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  art text not null check (art in ('verkaufen', 'tauschen', 'verschenken', 'suchen')),
  kategorie text not null references public.boerse_kategorien(schluessel),
  unterkategorie text references public.boerse_kategorien(schluessel),
  titel text not null check (char_length(titel) between 3 and 100),
  beschreibung text check (char_length(beschreibung) <= 3000),
  preis_cent integer check (preis_cent between 0 and 10000000),
  preis_vb boolean not null default false,
  zustand text check (zustand in ('neu', 'wie_neu', 'sehr_gut', 'gut', 'gebraucht', 'defekt')),
  groesse text check (char_length(groesse) <= 40),
  ort text check (char_length(ort) <= 80),
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  versand boolean not null default false,
  abholung boolean not null default true,
  tausch_moeglich boolean not null default false,
  bilder text[] not null default '{}' check (cardinality(bilder) <= 8),
  status text not null default 'aktiv'
    check (status in ('aktiv', 'pausiert', 'reserviert', 'verkauft', 'verschenkt', 'getauscht', 'beendet', 'gesperrt')),
  sperrgrund text check (char_length(sperrgrund) <= 300),
  erstellt_am timestamptz not null default now(),
  aktualisiert_am timestamptz not null default now()
);
comment on table public.boerse_angebote is 'TanzRaum Boerse: Angebote und Suchanzeigen (Community, keine Vereinsfunktion)';
create index if not exists boerse_angebote_status_zeit on public.boerse_angebote (status, erstellt_am desc);
create index if not exists boerse_angebote_kategorie on public.boerse_angebote (kategorie, status);
create index if not exists boerse_angebote_user on public.boerse_angebote (user_id);

create table if not exists public.boerse_favoriten (
  user_id uuid not null references public.profiles(id) on delete cascade,
  angebot_id uuid not null references public.boerse_angebote(id) on delete cascade,
  erstellt_am timestamptz not null default now(),
  primary key (user_id, angebot_id)
);

create table if not exists public.boerse_meldungen (
  id uuid primary key default gen_random_uuid(),
  angebot_id uuid not null references public.boerse_angebote(id) on delete cascade,
  melder_id uuid references public.profiles(id) on delete set null,
  grund text not null check (grund in ('unangemessen', 'falsche_angaben', 'spam', 'betrug', 'verboten', 'sonstiges')),
  text text check (char_length(text) <= 500),
  status text not null default 'offen' check (status in ('offen', 'erledigt', 'verworfen')),
  erstellt_am timestamptz not null default now(),
  bearbeitet_am timestamptz,
  bearbeitet_von uuid references public.profiles(id) on delete set null
);
create unique index if not exists boerse_meldungen_einmal on public.boerse_meldungen (angebot_id, melder_id) where status = 'offen';

create table if not exists public.boerse_kontakte (
  id uuid primary key default gen_random_uuid(),
  angebot_id uuid references public.boerse_angebote(id) on delete set null,
  interessent_id uuid not null references public.profiles(id) on delete cascade,
  anbieter_id uuid not null references public.profiles(id) on delete cascade,
  gespraech_id uuid not null references public.gespraeche(id) on delete cascade,
  erstellt_am timestamptz not null default now()
);
create unique index if not exists boerse_kontakte_einmal on public.boerse_kontakte (angebot_id, interessent_id);
create index if not exists boerse_kontakte_gespraech on public.boerse_kontakte (gespraech_id);

create table if not exists public.boerse_sperren (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  grund text not null check (char_length(grund) between 3 and 300),
  bis timestamptz,
  gesetzt_von uuid references public.profiles(id) on delete set null,
  gesetzt_am timestamptz not null default now()
);

-- ---------------------------------------------------------------------------------------------
-- Hilfsfunktionen
-- ---------------------------------------------------------------------------------------------
create or replace function public.boerse_gesperrt(p_user uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select exists (select 1 from boerse_sperren s where s.user_id = p_user and (s.bis is null or s.bis > now()))
      or exists (select 1 from profiles p where p.id = p_user and coalesce(p.gesperrt, false));
$function$;

-- Oeffentlich sichtbar (fuer alle Angemeldeten)
create or replace function public.boerse_sichtbar(a public.boerse_angebote)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select a.status in ('aktiv', 'reserviert') and not boerse_gesperrt(a.user_id);
$function$;

-- Darf ich eigene Angebote einstellen / Anbietende kontaktieren?
create or replace function public.boerse_darf_handeln()
 returns text
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select case
    when auth.uid() is null then 'nicht_angemeldet'
    when boerse_gesperrt(auth.uid()) then 'gesperrt'
    when ist_unter_16(auth.uid()) then 'unter_16'
    else null
  end;
$function$;

create or replace function public.boerse_entfernung_km(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
 returns double precision
 language sql
 immutable
 set search_path to 'public'
as $function$
  select case when lat1 is null or lng1 is null or lat2 is null or lng2 is null then null else
    6371 * 2 * asin(least(1, sqrt(power(sin(radians(lat2 - lat1) / 2), 2)
      + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)))) end;
$function$;

create or replace function public.boerse_anbieter_name(p_user uuid)
 returns text
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select coalesce((select a.anzeige from anzeige_namen(array[p_user]) a), 'TanzRaum-Mitglied');
$function$;

-- ---------------------------------------------------------------------------------------------
-- RLS: lesen fuer Angemeldete (sichtbare + eigene; Administration fuer Moderation), schreiben nur ueber RPCs
-- ---------------------------------------------------------------------------------------------
alter table public.boerse_angebote enable row level security;
alter table public.boerse_favoriten enable row level security;
alter table public.boerse_meldungen enable row level security;
alter table public.boerse_kontakte enable row level security;
alter table public.boerse_sperren enable row level security;

drop policy if exists "Boerse Angebote lesen" on public.boerse_angebote;
create policy "Boerse Angebote lesen" on public.boerse_angebote for select to authenticated
  using (user_id = auth.uid() or (status in ('aktiv', 'reserviert') and not boerse_gesperrt(user_id)) or ist_plattform_admin_aktuell());
drop policy if exists "Eigene Favoriten" on public.boerse_favoriten;
create policy "Eigene Favoriten" on public.boerse_favoriten for select to authenticated using (user_id = auth.uid());
drop policy if exists "Meldungen fuer Moderation" on public.boerse_meldungen;
create policy "Meldungen fuer Moderation" on public.boerse_meldungen for select to authenticated using (ist_plattform_admin_aktuell());
drop policy if exists "Eigene Boerse-Kontakte" on public.boerse_kontakte;
create policy "Eigene Boerse-Kontakte" on public.boerse_kontakte for select to authenticated
  using (auth.uid() in (interessent_id, anbieter_id));
drop policy if exists "Boerse-Sperren Moderation" on public.boerse_sperren;
create policy "Boerse-Sperren Moderation" on public.boerse_sperren for select to authenticated
  using (user_id = auth.uid() or ist_plattform_admin_aktuell());

revoke all on public.boerse_angebote, public.boerse_favoriten, public.boerse_meldungen, public.boerse_kontakte, public.boerse_sperren
  from public, anon, authenticated;
grant select on public.boerse_angebote, public.boerse_favoriten, public.boerse_meldungen, public.boerse_kontakte, public.boerse_sperren
  to authenticated;
grant all on public.boerse_angebote, public.boerse_favoriten, public.boerse_meldungen, public.boerse_kontakte, public.boerse_sperren,
  public.boerse_kategorien to service_role;

-- ---------------------------------------------------------------------------------------------
-- Bilder: privater Bucket, Pfad <user_id>/<angebot_id>/<datei>; lesen nur, wenn das Angebot sichtbar ist
-- ---------------------------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('boerse', 'boerse', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "Boerse Bilder lesen" on storage.objects;
create policy "Boerse Bilder lesen" on storage.objects for select to authenticated
  using (bucket_id = 'boerse' and exists (
    select 1 from public.boerse_angebote a
    where a.id::text = (storage.foldername(name))[2]
      and (a.user_id = auth.uid() or public.boerse_sichtbar(a) or public.ist_plattform_admin_aktuell())));
drop policy if exists "Boerse Bilder hochladen" on storage.objects;
create policy "Boerse Bilder hochladen" on storage.objects for insert to authenticated
  with check (bucket_id = 'boerse' and (storage.foldername(name))[1] = auth.uid()::text and public.boerse_darf_handeln() is null);
drop policy if exists "Boerse Bilder loeschen" on storage.objects;
create policy "Boerse Bilder loeschen" on storage.objects for delete to authenticated
  using (bucket_id = 'boerse' and ((storage.foldername(name))[1] = auth.uid()::text or public.ist_plattform_admin_aktuell()));

-- ---------------------------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------------------------
create or replace function public.boerse_angebot_json(a public.boerse_angebote, p_mit_details boolean default false)
 returns jsonb
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select jsonb_build_object(
    'id', a.id, 'art', a.art, 'kategorie', a.kategorie, 'unterkategorie', a.unterkategorie, 'titel', a.titel,
    'preis_cent', a.preis_cent, 'preis_vb', a.preis_vb, 'zustand', a.zustand, 'groesse', a.groesse, 'ort', a.ort,
    'versand', a.versand, 'abholung', a.abholung, 'tausch_moeglich', a.tausch_moeglich, 'bilder', to_jsonb(a.bilder),
    'status', a.status, 'erstellt_am', a.erstellt_am, 'aktualisiert_am', a.aktualisiert_am,
    'ist_meins', a.user_id = auth.uid(),
    'favorit', exists (select 1 from boerse_favoriten f where f.angebot_id = a.id and f.user_id = auth.uid()))
  || case when p_mit_details then jsonb_build_object(
    'beschreibung', a.beschreibung, 'sperrgrund', case when a.user_id = auth.uid() or ist_plattform_admin_aktuell() then a.sperrgrund end,
    'anbieter', jsonb_build_object('id', a.user_id, 'name', boerse_anbieter_name(a.user_id),
      'seit', (select to_char(p.created_at, 'YYYY') from profiles p where p.id = a.user_id),
      'angebote', (select count(*) from boerse_angebote x where x.user_id = a.user_id and boerse_sichtbar(x))),
    'favoriten', (select count(*) from boerse_favoriten f where f.angebot_id = a.id),
    'kontaktierbar', a.user_id <> auth.uid() and boerse_sichtbar(a) and not ist_unter_16(a.user_id)) else '{}'::jsonb end;
$function$;

-- Suche mit Filtern; p jsonb: q, art, kategorie, unterkategorie, groesse, zustand[], preis_min, preis_max (Cent),
-- kostenlos, versand, abholung, tausch, ort, lat, lng, umkreis_km, sortierung (neu|preis_auf|preis_ab|naehe), seite
create or replace function public.boerse_suche(p jsonb default '{}'::jsonb)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  v_q text := nullif(trim(coalesce(p->>'q', '')), '');
  v_lat double precision := nullif(p->>'lat', '')::double precision;
  v_lng double precision := nullif(p->>'lng', '')::double precision;
  v_umkreis double precision := nullif(p->>'umkreis_km', '')::double precision;
  v_sort text := coalesce(p->>'sortierung', 'neu');
  v_seite integer := greatest(coalesce(nullif(p->>'seite', '')::integer, 1), 1);
  v_proseite constant integer := 24;
  v_zustaende text[] := case when jsonb_typeof(p->'zustand') = 'array' then array(select jsonb_array_elements_text(p->'zustand')) end;
begin
  if auth.uid() is null then
    raise exception 'Bitte melde dich an.' using errcode = '42501';
  end if;
  v_q := replace(replace(left(v_q, 80), '%', ''), '_', ' ');
  return (
    with treffer as (
      select a.*, boerse_entfernung_km(v_lat, v_lng, a.lat, a.lng) as km
      from boerse_angebote a
      where boerse_sichtbar(a)
        and not ist_blockiert(auth.uid(), a.user_id)
        and (v_q is null or a.titel ilike '%' || v_q || '%' or a.beschreibung ilike '%' || v_q || '%' or a.groesse ilike '%' || v_q || '%')
        and (nullif(p->>'art', '') is null or a.art = p->>'art')
        and (nullif(p->>'kategorie', '') is null or a.kategorie = p->>'kategorie')
        and (nullif(p->>'unterkategorie', '') is null or a.unterkategorie = p->>'unterkategorie')
        and (nullif(p->>'groesse', '') is null or a.groesse ilike '%' || replace(replace(left(p->>'groesse', 20), '%', ''), '_', ' ') || '%')
        and (v_zustaende is null or cardinality(v_zustaende) = 0 or a.zustand = any(v_zustaende))
        and (nullif(p->>'preis_min', '') is null or a.preis_cent >= (p->>'preis_min')::integer)
        and (nullif(p->>'preis_max', '') is null or coalesce(a.preis_cent, 0) <= (p->>'preis_max')::integer)
        and (coalesce((p->>'kostenlos')::boolean, false) = false or a.art = 'verschenken' or a.preis_cent = 0)
        and (coalesce((p->>'versand')::boolean, false) = false or a.versand)
        and (coalesce((p->>'abholung')::boolean, false) = false or a.abholung)
        and (coalesce((p->>'tausch')::boolean, false) = false or a.tausch_moeglich or a.art = 'tauschen')
        and (nullif(p->>'ort', '') is null or a.ort ilike '%' || replace(replace(left(p->>'ort', 60), '%', ''), '_', ' ') || '%')
        and (v_umkreis is null or v_lat is null or boerse_entfernung_km(v_lat, v_lng, a.lat, a.lng) <= v_umkreis)
    )
    select jsonb_build_object(
      'anzahl', (select count(*) from treffer),
      'seite', v_seite,
      'pro_seite', v_proseite,
      'angebote', coalesce((
        select jsonb_agg(boerse_angebot_json(x) || jsonb_build_object('km', round(t.km::numeric, 0)) order by t.rn)
        from (
          select tr.id, tr.km, row_number() over (
            order by case v_sort when 'preis_auf' then coalesce(tr.preis_cent, 0)::double precision
                                 when 'preis_ab' then -coalesce(tr.preis_cent, 0)::double precision
                                 when 'naehe' then tr.km end nulls last, tr.erstellt_am desc) as rn
          from treffer tr
          order by rn
          limit v_proseite offset (v_seite - 1) * v_proseite
        ) t
        join boerse_angebote x on x.id = t.id), '[]'::jsonb)
    )
  );
end;
$function$;

create or replace function public.boerse_angebot(p_id uuid)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  a boerse_angebote%rowtype;
begin
  select * into a from boerse_angebote where id = p_id;
  if a.id is null or auth.uid() is null
     or not (a.user_id = auth.uid() or boerse_sichtbar(a) or ist_plattform_admin_aktuell())
     or (a.user_id <> auth.uid() and ist_blockiert(auth.uid(), a.user_id) and not ist_plattform_admin_aktuell()) then
    return null;
  end if;
  return boerse_angebot_json(a, true) || jsonb_build_object('mein_status', boerse_darf_handeln());
end;
$function$;

-- Anlegen/Bearbeiten (p_id vom Browser vorgegeben, damit die Bilder vorher in <user>/<id>/ hochgeladen werden koennen)
create or replace function public.boerse_angebot_speichern(p_id uuid, p jsonb)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_user uuid := auth.uid();
  v_alt boerse_angebote%rowtype;
  v_grund text := boerse_darf_handeln();
  v_art text := p->>'art';
  v_bilder text[] := case when jsonb_typeof(p->'bilder') = 'array' then array(select jsonb_array_elements_text(p->'bilder')) else '{}' end;
  v_preis integer := nullif(p->>'preis_cent', '')::integer;
  v_kat text := p->>'kategorie';
  v_unter text := nullif(p->>'unterkategorie', '');
  b text;
begin
  if v_grund = 'unter_16' then
    raise exception 'Angebote können erst ab 16 Jahren eingestellt werden. Frag deine Eltern, ob sie es für dich einstellen.' using errcode = '42501';
  elsif v_grund = 'gesperrt' then
    raise exception 'Du kannst die TanzRaum Börse derzeit nicht nutzen. Bei Fragen: info@tanzraum.app' using errcode = '42501';
  elsif v_grund is not null then
    raise exception 'Bitte melde dich an.' using errcode = '42501';
  end if;
  if p_id is null then raise exception 'Ungültiges Angebot.' using errcode = 'P0001'; end if;
  select * into v_alt from boerse_angebote where id = p_id for update;
  if v_alt.id is not null and v_alt.user_id <> v_user then
    raise exception 'Nur eigene Angebote können bearbeitet werden.' using errcode = '42501';
  end if;
  if v_alt.status = 'gesperrt' then
    raise exception 'Dieses Angebot wurde von der Moderation gesperrt.' using errcode = 'P0001';
  end if;
  if v_art not in ('verkaufen', 'tauschen', 'verschenken', 'suchen') then raise exception 'Bitte wähle die Art des Angebots.' using errcode = 'P0001'; end if;
  if not exists (select 1 from boerse_kategorien k where k.schluessel = v_kat and k.eltern is null and k.aktiv) then
    raise exception 'Bitte wähle eine Kategorie.' using errcode = 'P0001';
  end if;
  if v_unter is not null and not exists (select 1 from boerse_kategorien k where k.schluessel = v_unter and k.eltern = v_kat and k.aktiv) then
    v_unter := null;
  end if;
  if char_length(trim(coalesce(p->>'titel', ''))) < 3 then raise exception 'Bitte gib einen Titel mit mindestens 3 Zeichen an.' using errcode = 'P0001'; end if;
  if v_art = 'verkaufen' and v_preis is null then raise exception 'Bitte gib einen Preis an (oder wähle „Verschenken“).' using errcode = 'P0001'; end if;
  if v_art in ('verschenken') then v_preis := 0; end if;
  if v_art = 'tauschen' then v_preis := null; end if;
  if cardinality(v_bilder) > 8 then raise exception 'Höchstens 8 Bilder.' using errcode = 'P0001'; end if;
  foreach b in array v_bilder loop
    if b !~ ('^' || v_user::text || '/' || p_id::text || '/[A-Za-z0-9._-]{1,80}$') then
      raise exception 'Ungültiges Bild.' using errcode = 'P0001';
    end if;
  end loop;
  -- Keine Kontaktdaten im Text (Datenschutz, Kontakt nur ueber den TanzRaum-Chat)
  if coalesce(p->>'titel', '') || ' ' || coalesce(p->>'beschreibung', '') ~* '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}'
     or regexp_replace(coalesce(p->>'titel', '') || ' ' || coalesce(p->>'beschreibung', ''), '[\s/().-]', '', 'g') ~ '(\+49|0049|\m0)1[5-7][0-9]{7,9}' then
    raise exception 'Bitte keine Telefonnummern oder E-Mail-Adressen ins Angebot schreiben – Interessierte erreichen dich über den TanzRaum-Chat.' using errcode = 'P0001';
  end if;
  if v_alt.id is null then
    if (select count(*) from boerse_angebote x where x.user_id = v_user and x.erstellt_am > now() - interval '1 day') >= 20 then
      raise exception 'Du hast heute schon 20 Angebote eingestellt. Bitte versuche es morgen wieder.' using errcode = 'P0001';
    end if;
    if (select count(*) from boerse_angebote x where x.user_id = v_user and x.status in ('aktiv', 'pausiert', 'reserviert')) >= 100 then
      raise exception 'Du hast bereits 100 aktive Angebote.' using errcode = 'P0001';
    end if;
  end if;

  insert into boerse_angebote as x (id, user_id, art, kategorie, unterkategorie, titel, beschreibung, preis_cent, preis_vb, zustand, groesse,
                                    ort, lat, lng, versand, abholung, tausch_moeglich, bilder)
  values (p_id, v_user, v_art, v_kat, v_unter, left(trim(p->>'titel'), 100), nullif(left(trim(coalesce(p->>'beschreibung', '')), 3000), ''),
          v_preis, coalesce((p->>'preis_vb')::boolean, false) and v_art = 'verkaufen',
          case when v_art = 'suchen' then null else nullif(p->>'zustand', '') end,
          nullif(left(trim(coalesce(p->>'groesse', '')), 40), ''),
          nullif(left(trim(coalesce(p->>'ort', '')), 80), ''),
          round(nullif(p->>'lat', '')::numeric, 2)::double precision, round(nullif(p->>'lng', '')::numeric, 2)::double precision,
          coalesce((p->>'versand')::boolean, false), coalesce((p->>'abholung')::boolean, true),
          coalesce((p->>'tausch_moeglich')::boolean, false) or v_art = 'tauschen', v_bilder)
  on conflict (id) do update set
    art = excluded.art, kategorie = excluded.kategorie, unterkategorie = excluded.unterkategorie, titel = excluded.titel,
    beschreibung = excluded.beschreibung, preis_cent = excluded.preis_cent, preis_vb = excluded.preis_vb, zustand = excluded.zustand,
    groesse = excluded.groesse, ort = excluded.ort,
    lat = case when excluded.ort is distinct from x.ort then excluded.lat else coalesce(excluded.lat, x.lat) end,
    lng = case when excluded.ort is distinct from x.ort then excluded.lng else coalesce(excluded.lng, x.lng) end,
    versand = excluded.versand, abholung = excluded.abholung, tausch_moeglich = excluded.tausch_moeglich, bilder = excluded.bilder,
    aktualisiert_am = now();
  return p_id;
end;
$function$;

-- Status durch die anbietende Person (nicht „gesperrt“)
create or replace function public.boerse_status_setzen(p_id uuid, p_status text)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  a boerse_angebote%rowtype;
begin
  select * into a from boerse_angebote where id = p_id for update;
  if a.id is null or a.user_id <> auth.uid() then
    raise exception 'Nur eigene Angebote.' using errcode = '42501';
  end if;
  if a.status = 'gesperrt' then raise exception 'Dieses Angebot wurde von der Moderation gesperrt.' using errcode = 'P0001'; end if;
  if p_status not in ('aktiv', 'pausiert', 'reserviert', 'verkauft', 'verschenkt', 'getauscht', 'beendet') then
    raise exception 'Ungültiger Status.' using errcode = 'P0001';
  end if;
  if p_status in ('aktiv', 'reserviert') and boerse_darf_handeln() is not null then
    raise exception 'Du kannst die TanzRaum Börse derzeit nicht nutzen.' using errcode = '42501';
  end if;
  update boerse_angebote set status = p_status, aktualisiert_am = now() where id = p_id;
end;
$function$;

-- Loeschen durch die anbietende Person; gibt die Bildpfade zurueck (App entfernt die Dateien)
create or replace function public.boerse_angebot_loeschen(p_id uuid)
 returns text[]
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_bilder text[];
begin
  delete from boerse_angebote where id = p_id and (user_id = auth.uid() or ist_plattform_admin_aktuell()) returning bilder into v_bilder;
  if v_bilder is null then raise exception 'Angebot nicht gefunden.' using errcode = 'P0001'; end if;
  return v_bilder;
end;
$function$;

create or replace function public.boerse_favorit_setzen(p_id uuid, p_an boolean)
 returns boolean
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if auth.uid() is null then raise exception 'Bitte melde dich an.' using errcode = '42501'; end if;
  if p_an then
    if not exists (select 1 from boerse_angebote a where a.id = p_id and (boerse_sichtbar(a) or a.user_id = auth.uid())) then
      raise exception 'Angebot nicht verfügbar.' using errcode = 'P0001';
    end if;
    if (select count(*) from boerse_favoriten f where f.user_id = auth.uid()) >= 300 then
      raise exception 'Du hast bereits 300 Favoriten.' using errcode = 'P0001';
    end if;
    insert into boerse_favoriten (user_id, angebot_id) values (auth.uid(), p_id) on conflict do nothing;
  else
    delete from boerse_favoriten where user_id = auth.uid() and angebot_id = p_id;
  end if;
  return p_an;
end;
$function$;

create or replace function public.boerse_meine(p_bereich text default 'angebote')
 returns jsonb
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select case when auth.uid() is null then '[]'::jsonb
  when p_bereich = 'favoriten' then coalesce((
    select jsonb_agg(boerse_angebot_json(a) || jsonb_build_object('verfuegbar', boerse_sichtbar(a)) order by f.erstellt_am desc)
    from boerse_favoriten f join boerse_angebote a on a.id = f.angebot_id
    where f.user_id = auth.uid()), '[]'::jsonb)
  else coalesce((
    select jsonb_agg(boerse_angebot_json(a, true) || jsonb_build_object(
      'kontakte', (select count(*) from boerse_kontakte k where k.angebot_id = a.id)) order by a.aktualisiert_am desc)
    from boerse_angebote a where a.user_id = auth.uid()), '[]'::jsonb) end;
$function$;

create or replace function public.boerse_melden(p_id uuid, p_grund text, p_text text)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  a boerse_angebote%rowtype;
begin
  if auth.uid() is null then raise exception 'Bitte melde dich an.' using errcode = '42501'; end if;
  select * into a from boerse_angebote where id = p_id;
  if a.id is null or not boerse_sichtbar(a) then raise exception 'Angebot nicht verfügbar.' using errcode = 'P0001'; end if;
  if a.user_id = auth.uid() then raise exception 'Eigene Angebote kannst du nicht melden.' using errcode = 'P0001'; end if;
  if p_grund not in ('unangemessen', 'falsche_angaben', 'spam', 'betrug', 'verboten', 'sonstiges') then
    raise exception 'Bitte wähle einen Grund.' using errcode = 'P0001';
  end if;
  if (select count(*) from boerse_meldungen m where m.melder_id = auth.uid() and m.erstellt_am > now() - interval '1 day') >= 20 then
    raise exception 'Du hast heute schon viele Meldungen gesendet – danke! Bitte versuche es morgen wieder.' using errcode = 'P0001';
  end if;
  insert into boerse_meldungen (angebot_id, melder_id, grund, text)
  values (p_id, auth.uid(), p_grund, nullif(left(trim(coalesce(p_text, '')), 500), ''))
  on conflict (angebot_id, melder_id) where status = 'offen' do update set grund = excluded.grund, text = excluded.text, erstellt_am = now();
end;
$function$;

-- Kontakt ueber den TanzRaum-Chat: vorhandenen Privatchat nutzen oder anlegen, Angebot als erste Nachricht
create or replace function public.boerse_kontaktieren(p_id uuid)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_ich uuid := auth.uid();
  a boerse_angebote%rowtype;
  v_schluessel text;
  v_gespraech uuid;
  v_neu boolean;
begin
  select * into a from boerse_angebote where id = p_id;
  if a.id is null or not boerse_sichtbar(a) then raise exception 'Dieses Angebot ist nicht mehr verfügbar.' using errcode = 'P0001'; end if;
  if a.user_id = v_ich then raise exception 'Das ist dein eigenes Angebot.' using errcode = 'P0001'; end if;
  if boerse_darf_handeln() = 'unter_16' then
    raise exception 'Anbietende kannst du erst ab 16 Jahren kontaktieren. Frag deine Eltern, ob sie sich melden.' using errcode = '42501';
  elsif boerse_darf_handeln() is not null then
    raise exception 'Du kannst die TanzRaum Börse derzeit nicht nutzen.' using errcode = '42501';
  end if;
  if eltern_nachrichtensperre(v_ich) then
    raise exception 'Deine Eltern haben Nachrichten ausgeschaltet.' using errcode = '42501';
  end if;
  if ist_blockiert(v_ich, a.user_id) or ist_unter_16(a.user_id) or eltern_nachrichtensperre(a.user_id) then
    raise exception 'Diese Person kann gerade nicht kontaktiert werden.' using errcode = 'P0001';
  end if;
  if (select count(*) from boerse_kontakte k where k.interessent_id = v_ich and k.erstellt_am > now() - interval '1 day') >= 30 then
    raise exception 'Du hast heute schon viele Anbietende kontaktiert. Bitte versuche es morgen wieder.' using errcode = 'P0001';
  end if;

  v_schluessel := least(v_ich, a.user_id)::text || ':' || greatest(v_ich, a.user_id)::text;
  select g.id into v_gespraech from gespraeche g where g.dm_schluessel = v_schluessel;
  if v_gespraech is null then
    insert into gespraeche (typ, dm_schluessel, erstellt_von) values ('dm', v_schluessel, v_ich) returning id into v_gespraech;
    insert into gespraech_teilnehmer (gespraech_id, user_id, last_read_at) values (v_gespraech, v_ich, now()), (v_gespraech, a.user_id, now() - interval '1 second');
  end if;
  insert into boerse_kontakte (angebot_id, interessent_id, anbieter_id, gespraech_id)
  values (a.id, v_ich, a.user_id, v_gespraech)
  on conflict (angebot_id, interessent_id) do nothing
  returning true into v_neu;
  if coalesce(v_neu, false) then
    insert into nachrichten (gespraech_id, sender_id, inhalt)
    values (v_gespraech, v_ich, '🛍️ Anfrage zur TanzRaum Börse: „' || a.titel || '“' || chr(10) || '/dashboard/boerse/' || a.id);
  end if;
  return v_gespraech;
end;
$function$;

-- Schreiben in einem Privatchat, der ueber die Boerse entstanden ist (nur Nachrichten, beide ab 16, keine Sperren)
create or replace function public.boerse_darf_schreiben(p_gespraech_id uuid, p_partner uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select auth.uid() is not null and exists (
      select 1 from boerse_kontakte k
      where k.gespraech_id = p_gespraech_id
        and ((k.interessent_id = auth.uid() and k.anbieter_id = p_partner) or (k.anbieter_id = auth.uid() and k.interessent_id = p_partner)))
    and exists (select 1 from profiles p where p.id = p_partner and not coalesce(p.gesperrt, false))
    and not ist_blockiert(auth.uid(), p_partner)
    and not ist_unter_16(auth.uid()) and not ist_unter_16(p_partner)
    and not eltern_nachrichtensperre(auth.uid()) and not eltern_nachrichtensperre(p_partner)
    and not boerse_gesperrt(auth.uid());
$function$;

do $mig$
declare
  d text;
  alt text;
  neu text;
begin
  -- Privatchat: zusaetzlich schreiben, wenn der Chat ueber ein Boerse-Angebot entstanden ist
  d := pg_get_functiondef('public.darf_im_gespraech_schreiben(uuid)'::regprocedure);
  alt := $o$select 1 from gespraech_teilnehmer t where t.gespraech_id = g.id and t.user_id <> auth.uid() and darf_direkt_schreiben(t.user_id))$o$;
  neu := $n$select 1 from gespraech_teilnehmer t where t.gespraech_id = g.id and t.user_id <> auth.uid()
            and (darf_direkt_schreiben(t.user_id) or boerse_darf_schreiben(g.id, t.user_id)))$n$;
  if position(alt in d) = 0 then raise exception 'darf_im_gespraech_schreiben: Ausdruck nicht gefunden'; end if;
  execute replace(d, alt, neu);

  -- Anrufe nur mit den bisherigen Regeln (nicht ueber die Boerse)
  d := pg_get_functiondef('public.anruf_starten(uuid, text)'::regprocedure);
  alt := $o$  select t.user_id into v_partner from gespraech_teilnehmer t where t.gespraech_id = g.id and t.user_id <> auth.uid() limit 1;$o$;
  neu := $n$  select t.user_id into v_partner from gespraech_teilnehmer t where t.gespraech_id = g.id and t.user_id <> auth.uid() limit 1;
  if not darf_direkt_schreiben(v_partner) then
    raise exception 'Über die TanzRaum Börse sind nur Nachrichten möglich, keine Anrufe.' using errcode = 'P0001';
  end if;$n$;
  if position(alt in d) = 0 then raise exception 'anruf_starten: Ausdruck nicht gefunden'; end if;
  execute replace(d, alt, neu);

  -- Chatliste: Untertitel „Börse · Titel“ fuer Privatchats aus der Boerse
  d := pg_get_functiondef('public.chat_liste()'::regprocedure);
  alt := $o$when 'dm' then case when exists (select 1 from profiles ap where ap.id = pt.user_id and coalesce(ap.ist_plattform_admin, false)) then 'TanzRaum Admin' end$o$;
  neu := $n$when 'dm' then coalesce(case when exists (select 1 from profiles ap where ap.id = pt.user_id and coalesce(ap.ist_plattform_admin, false)) then 'TanzRaum Admin' end,
        (select 'Börse · ' || ba.titel from boerse_kontakte bk join boerse_angebote ba on ba.id = bk.angebot_id
         where bk.gespraech_id = s.id order by bk.erstellt_am desc limit 1))$n$;
  if position(alt in d) = 0 then raise exception 'chat_liste: Ausdruck nicht gefunden'; end if;
  execute replace(d, alt, neu);

  -- Datenexport: eigene Angebote, Favoriten, Meldungen, Kontakte
  d := pg_get_functiondef('public.meine_daten_export()'::regprocedure);
  alt := $o$('fahrgemeinschaften', 'erstellt_von', array[]::text[])$o$;
  neu := $n$('fahrgemeinschaften', 'erstellt_von', array[]::text[]), ('boerse_angebote', 'user_id', array[]::text[]),
      ('boerse_favoriten', 'user_id', array[]::text[]), ('boerse_meldungen', 'melder_id', array[]::text[]),
      ('boerse_kontakte', 'interessent_id', array[]::text[])$n$;
  if position(alt in d) = 0 then raise exception 'meine_daten_export: Ausdruck nicht gefunden'; end if;
  execute replace(d, alt, neu);
end
$mig$;

-- ---------------------------------------------------------------------------------------------
-- Moderation (Plattform-Administration): nur fuer die Moderation noetige Daten
-- ---------------------------------------------------------------------------------------------
create or replace function public.admin_boerse_meldungen()
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
begin
  if not ist_plattform_admin_aktuell() then raise exception 'Nur für die TanzRaum-Administration.' using errcode = '42501'; end if;
  return jsonb_build_object(
    'angebote', coalesce((
      select jsonb_agg(boerse_angebot_json(a, true) || jsonb_build_object(
          'meldungen', (select jsonb_agg(jsonb_build_object('id', m.id, 'grund', m.grund, 'text', m.text, 'erstellt_am', m.erstellt_am)
                                         order by m.erstellt_am desc)
                        from boerse_meldungen m where m.angebot_id = a.id and m.status = 'offen'),
          'anbieter_boerse_gesperrt', boerse_gesperrt(a.user_id))
        order by (select max(m.erstellt_am) from boerse_meldungen m where m.angebot_id = a.id and m.status = 'offen') desc)
      from boerse_angebote a
      where exists (select 1 from boerse_meldungen m where m.angebot_id = a.id and m.status = 'offen')), '[]'::jsonb),
    'gesperrte_angebote', coalesce((
      select jsonb_agg(boerse_angebot_json(a, true) order by a.aktualisiert_am desc)
      from (select * from boerse_angebote where status = 'gesperrt' order by aktualisiert_am desc limit 50) a), '[]'::jsonb),
    'sperren', coalesce((
      select jsonb_agg(jsonb_build_object('user_id', s.user_id, 'name', boerse_anbieter_name(s.user_id), 'grund', s.grund, 'bis', s.bis,
                                          'gesetzt_am', s.gesetzt_am) order by s.gesetzt_am desc)
      from boerse_sperren s where s.bis is null or s.bis > now()), '[]'::jsonb),
    'zahlen', jsonb_build_object(
      'aktiv', (select count(*) from boerse_angebote where status in ('aktiv', 'reserviert')),
      'gesamt', (select count(*) from boerse_angebote),
      'offene_meldungen', (select count(*) from boerse_meldungen where status = 'offen')));
end;
$function$;

create or replace function public.admin_boerse_entscheiden(p_angebot_id uuid, p_aktion text, p_grund text default null)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  a boerse_angebote%rowtype;
begin
  if not ist_plattform_admin_aktuell() then raise exception 'Nur für die TanzRaum-Administration.' using errcode = '42501'; end if;
  select * into a from boerse_angebote where id = p_angebot_id for update;
  if a.id is null then raise exception 'Angebot nicht gefunden.' using errcode = 'P0001'; end if;
  if p_aktion = 'sperren' then
    if char_length(trim(coalesce(p_grund, ''))) < 3 then raise exception 'Bitte einen Grund angeben.' using errcode = 'P0001'; end if;
    update boerse_angebote set status = 'gesperrt', sperrgrund = left(trim(p_grund), 300), aktualisiert_am = now() where id = a.id;
    update boerse_meldungen set status = 'erledigt', bearbeitet_am = now(), bearbeitet_von = auth.uid() where angebot_id = a.id and status = 'offen';
    insert into benachrichtigungen (user_id, typ, text)
    values (a.user_id, 'boerse', 'Dein Börsen-Angebot „' || a.titel || '“ wurde von der Moderation deaktiviert: ' || left(trim(p_grund), 200));
  elsif p_aktion = 'freigeben' then
    update boerse_angebote set status = case when status = 'gesperrt' then 'pausiert' else status end, sperrgrund = null, aktualisiert_am = now()
    where id = a.id;
    update boerse_meldungen set status = 'verworfen', bearbeitet_am = now(), bearbeitet_von = auth.uid() where angebot_id = a.id and status = 'offen';
  else
    raise exception 'Unbekannte Aktion.' using errcode = 'P0001';
  end if;
end;
$function$;

create or replace function public.admin_boerse_sperre(p_user_id uuid, p_grund text, p_tage integer)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if not ist_plattform_admin_aktuell() then raise exception 'Nur für die TanzRaum-Administration.' using errcode = '42501'; end if;
  if p_tage is null then
    delete from boerse_sperren where user_id = p_user_id;
    return;
  end if;
  if char_length(trim(coalesce(p_grund, ''))) < 3 then raise exception 'Bitte einen Grund angeben.' using errcode = 'P0001'; end if;
  insert into boerse_sperren (user_id, grund, bis, gesetzt_von)
  values (p_user_id, left(trim(p_grund), 300), case when p_tage > 0 then now() + make_interval(days => p_tage) end, auth.uid())
  on conflict (user_id) do update set grund = excluded.grund, bis = excluded.bis, gesetzt_von = excluded.gesetzt_von, gesetzt_am = now();
  update boerse_angebote set status = 'pausiert', aktualisiert_am = now() where user_id = p_user_id and status in ('aktiv', 'reserviert');
  insert into benachrichtigungen (user_id, typ, text)
  values (p_user_id, 'boerse', 'Deine Nutzung der TanzRaum Börse wurde ' || case when p_tage > 0 then 'für ' || p_tage || ' Tage ' else '' end
          || 'eingeschränkt: ' || left(trim(p_grund), 200));
end;
$function$;

-- Rechte
revoke execute on function public.boerse_gesperrt(uuid), public.boerse_sichtbar(public.boerse_angebote), public.boerse_darf_handeln(),
  public.boerse_entfernung_km(double precision, double precision, double precision, double precision), public.boerse_anbieter_name(uuid),
  public.boerse_angebot_json(public.boerse_angebote, boolean), public.boerse_suche(jsonb), public.boerse_angebot(uuid),
  public.boerse_angebot_speichern(uuid, jsonb), public.boerse_status_setzen(uuid, text), public.boerse_angebot_loeschen(uuid),
  public.boerse_favorit_setzen(uuid, boolean), public.boerse_meine(text), public.boerse_melden(uuid, text, text),
  public.boerse_kontaktieren(uuid), public.boerse_darf_schreiben(uuid, uuid), public.admin_boerse_meldungen(),
  public.admin_boerse_entscheiden(uuid, text, text), public.admin_boerse_sperre(uuid, text, integer) from public, anon;
revoke execute on function public.boerse_anbieter_name(uuid), public.boerse_angebot_json(public.boerse_angebote, boolean)
  from authenticated;
grant execute on function public.boerse_gesperrt(uuid), public.boerse_sichtbar(public.boerse_angebote), public.boerse_darf_handeln(),
  public.boerse_entfernung_km(double precision, double precision, double precision, double precision),
  public.boerse_suche(jsonb), public.boerse_angebot(uuid), public.boerse_angebot_speichern(uuid, jsonb), public.boerse_status_setzen(uuid, text),
  public.boerse_angebot_loeschen(uuid), public.boerse_favorit_setzen(uuid, boolean), public.boerse_meine(text),
  public.boerse_melden(uuid, text, text), public.boerse_kontaktieren(uuid), public.boerse_darf_schreiben(uuid, uuid),
  public.admin_boerse_meldungen(), public.admin_boerse_entscheiden(uuid, text, text), public.admin_boerse_sperre(uuid, text, integer)
  to authenticated;
