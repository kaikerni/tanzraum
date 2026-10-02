-- 🎓 Workshops · 💬 TanzRaum Treff · 📚 TanzRaum Wissen
--
-- Alle drei Bereiche sind nur mit TanzRaum-Konto nutzbar (RLS: authenticated). Schreibende Aktionen laufen ausschliesslich
-- ueber SECURITY-DEFINER-Funktionen, die Tarif, Jugendschutz, Sperren und Team-Rechte serverseitig pruefen.
--   - Workshops: ansehen ab FREE; einreichen ab 16 Jahren; oeffentlich erst nach zentraler Freigabe (Admin/Team).
--   - Treff: lesen und melden ab FREE; Themen/Antworten ab BASIC bzw. ueber die Vereinslizenz (ab 16 Jahren);
--     Moderation nur TanzRaum-Admin und Teammitglieder mit dem jeweiligen Recht – nie Vereinsadmins.
--   - Wissen: lesen ab FREE; erstellen/bearbeiten/veroeffentlichen/loeschen nur Admin bzw. Team mit Recht.
-- Meldungen nutzen die bestehende Tabelle meldungen (Bereich 'treff'), Benachrichtigungen die bestehende Glocke.

-- =============================================================================================
-- 0) Gemeinsames: Link an Benachrichtigungen, erweiterte Meldungen
-- =============================================================================================
alter table public.benachrichtigungen add column if not exists link text;
alter table public.benachrichtigungen drop constraint if exists benachrichtigungen_link_check;
alter table public.benachrichtigungen add constraint benachrichtigungen_link_check check (link is null or link ~ '^/dashboard(/[A-Za-z0-9/_#?=&.-]*)?$');

alter table public.meldungen drop constraint if exists meldungen_grund_check;
alter table public.meldungen add constraint meldungen_grund_check check (grund = any (array['unangemessen', 'belaestigung',
  'unerwuenschter_kontakt', 'jugendgefaehrdend', 'spam', 'sonstiges', 'beleidigung', 'werbung', 'problematisch']));
alter table public.meldungen drop constraint if exists meldungen_status_check;
alter table public.meldungen add constraint meldungen_status_check check (status = any (array['offen', 'in_pruefung', 'erledigt', 'keine_massnahme']));

create or replace function public.bundeslaender()
 returns text[]
 language sql
 immutable
 set search_path to 'public'
as $function$
  select array['Baden-Württemberg', 'Bayern', 'Berlin', 'Brandenburg', 'Bremen', 'Hamburg', 'Hessen', 'Mecklenburg-Vorpommern',
               'Niedersachsen', 'Nordrhein-Westfalen', 'Rheinland-Pfalz', 'Saarland', 'Sachsen', 'Sachsen-Anhalt',
               'Schleswig-Holstein', 'Thüringen'];
$function$;
grant execute on function public.bundeslaender() to authenticated;

-- Anzeige von Autorinnen/Autoren: Profilbild, @Nutzername, Verein (offiziell, sonst freiwillige Profilangabe), Team-Kennzeichen.
-- Kein Vor-/Nachname.
create or replace function public.community_autoren(p_user_ids uuid[])
 returns table(user_id uuid, handle text, avatar_url text, verein text, kennzeichen text)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select p.id, p.handle, p.avatar_url,
    coalesce((select v.name from vereine v where v.id = offizieller_verein_von(p.id)), nullif(btrim(p.verein_angabe), '')),
    (select k.kennzeichen from team_kennzeichen(array[p.id]) k)
  from profiles p
  where p.id = any(p_user_ids) and auth.uid() is not null;
$function$;
revoke all on function public.community_autoren(uuid[]) from public, anon;
grant execute on function public.community_autoren(uuid[]) to authenticated;

-- =============================================================================================
-- 1) Workshops
-- =============================================================================================
create table if not exists public.workshops (
  id uuid primary key default gen_random_uuid(),
  titel text not null check (char_length(btrim(titel)) between 3 and 140),
  datum date not null,
  datum_bis date,
  uhrzeit_von time,
  uhrzeit_bis time,
  ausrichter text not null check (char_length(btrim(ausrichter)) between 2 and 140),
  ort text not null check (char_length(btrim(ort)) between 2 and 140),
  adresse text check (char_length(adresse) <= 200),
  bundesland text not null check (bundesland = any(bundeslaender())),
  kategorie text check (kategorie in ('gardetanz', 'schautanz', 'technik', 'akrobatik', 'choreografie', 'trainer', 'nachwuchs', 'sonstiges')),
  beschreibung text not null check (char_length(btrim(beschreibung)) between 10 and 5000),
  ansprechpartner text check (char_length(ansprechpartner) <= 140),
  kontakt text check (char_length(kontakt) <= 200),
  link text check (link is null or (link ~ '^https?://\S+$' and char_length(link) <= 500)),
  bild_pfad text check (bild_pfad is null or bild_pfad ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$'),
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  status text not null default 'eingereicht' check (status in ('entwurf', 'eingereicht', 'freigegeben', 'abgelehnt', 'archiviert')),
  ablehnungsgrund text check (char_length(ablehnungsgrund) <= 1000),
  eingereicht_von uuid references public.profiles(id) on delete set null,
  geprueft_von uuid references public.profiles(id) on delete set null,
  geprueft_am timestamptz,
  erstellt_am timestamptz not null default now(),
  geaendert_am timestamptz not null default now(),
  constraint workshops_datum_bis check (datum_bis is null or datum_bis >= datum)
);
create index if not exists workshops_status_datum on public.workshops (status, datum);
create index if not exists workshops_eingereicht_von on public.workshops (eingereicht_von);
comment on table public.workshops is 'Workshops rund um den karnevalistischen Tanzsport – sichtbar nur mit Konto und erst nach Freigabe';
comment on column public.workshops.bundesland is 'Bundesland als Klartext aus bundeslaender() (Auswahlfeld)';

alter table public.workshops enable row level security;
drop policy if exists "Workshops lesen" on public.workshops;
create policy "Workshops lesen" on public.workshops for select to authenticated
  using (status = 'freigegeben' or eingereicht_von = auth.uid() or team_darf('workshops.ansehen')
         or team_darf('workshops.freigeben') or team_darf('workshops.bearbeiten'));
revoke all on public.workshops from public, anon, authenticated;
grant select on public.workshops to authenticated;
grant all on public.workshops to service_role;

-- Werte aus dem Formular pruefen und uebernehmen (gemeinsam fuer Einreichen und Bearbeiten)
create or replace function public.workshop_werte(p jsonb)
 returns public.workshops
 language plpgsql
 stable
 set search_path to 'public'
as $function$
declare
  w workshops;
begin
  w.titel := btrim(coalesce(p->>'titel', ''));
  w.datum := nullif(p->>'datum', '')::date;
  w.datum_bis := nullif(p->>'datum_bis', '')::date;
  w.uhrzeit_von := nullif(p->>'uhrzeit_von', '')::time;
  w.uhrzeit_bis := nullif(p->>'uhrzeit_bis', '')::time;
  w.ausrichter := btrim(coalesce(p->>'ausrichter', ''));
  w.ort := btrim(coalesce(p->>'ort', ''));
  w.adresse := nullif(btrim(coalesce(p->>'adresse', '')), '');
  w.bundesland := p->>'bundesland';
  w.kategorie := nullif(p->>'kategorie', '');
  w.beschreibung := btrim(coalesce(p->>'beschreibung', ''));
  w.ansprechpartner := nullif(btrim(coalesce(p->>'ansprechpartner', '')), '');
  w.kontakt := nullif(btrim(coalesce(p->>'kontakt', '')), '');
  w.link := nullif(btrim(coalesce(p->>'link', '')), '');
  w.bild_pfad := nullif(p->>'bild_pfad', '');
  w.lat := nullif(p->>'lat', '')::double precision;
  w.lng := nullif(p->>'lng', '')::double precision;
  if w.datum is null then raise exception 'Bitte ein Datum angeben.' using errcode = 'P0001'; end if;
  if w.bundesland is null or not (w.bundesland = any(bundeslaender())) then raise exception 'Bitte das Bundesland auswählen.' using errcode = 'P0001'; end if;
  return w;
end;
$function$;
revoke all on function public.workshop_werte(jsonb) from public, anon, authenticated;

-- Einreichen: jedes Konto ab 16 Jahren (nicht gesperrt). Status EINGEREICHT (bzw. ENTWURF). Teammitglieder mit
-- „workshops.erstellen“ und „workshops.freigeben“ koennen direkt freigegeben anlegen.
create or replace function public.workshop_einreichen(p jsonb, p_entwurf boolean default false, p_direkt_freigeben boolean default false)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  w workshops;
  v_id uuid;
  v_status text := case when coalesce(p_entwurf, false) then 'entwurf' else 'eingereicht' end;
begin
  if auth.uid() is null or exists (select 1 from profiles x where x.id = auth.uid() and coalesce(x.gesperrt, false)) then
    raise exception 'Nicht angemeldet.' using errcode = '42501';
  end if;
  if ist_unter_16(auth.uid()) then raise exception 'Workshops einreichen ist ab 16 Jahren möglich.' using errcode = '42501'; end if;
  if (select count(*) from workshops x where x.eingereicht_von = auth.uid() and x.erstellt_am > now() - interval '1 day') >= 10 then
    raise exception 'Du hast heute schon viele Workshops eingereicht. Bitte versuche es morgen erneut.' using errcode = 'P0001';
  end if;
  w := workshop_werte(p);
  if w.bild_pfad is not null and split_part(w.bild_pfad, '/', 1) <> auth.uid()::text then
    raise exception 'Das Bild konnte nicht zugeordnet werden.' using errcode = 'P0001';
  end if;
  if coalesce(p_direkt_freigeben, false) then
    if not (team_darf('workshops.erstellen') and team_darf('workshops.freigeben')) then
      raise exception 'Direkt freigeben darf nur das TanzRaum-Team mit Freigaberecht.' using errcode = '42501';
    end if;
    v_status := 'freigegeben';
  end if;
  insert into workshops (titel, datum, datum_bis, uhrzeit_von, uhrzeit_bis, ausrichter, ort, adresse, bundesland, kategorie, beschreibung,
                         ansprechpartner, kontakt, link, bild_pfad, lat, lng, status, eingereicht_von, geprueft_von, geprueft_am)
  values (w.titel, w.datum, w.datum_bis, w.uhrzeit_von, w.uhrzeit_bis, w.ausrichter, w.ort, w.adresse, w.bundesland, w.kategorie, w.beschreibung,
          w.ansprechpartner, w.kontakt, w.link, w.bild_pfad, w.lat, w.lng, v_status, auth.uid(),
          case when v_status = 'freigegeben' then auth.uid() end, case when v_status = 'freigegeben' then now() end)
  returning id into v_id;
  if v_status = 'freigegeben' then perform protokollieren('workshop_freigegeben', null, jsonb_build_object('workshop_id', v_id, 'titel', w.titel)); end if;
  return v_id;
end;
$function$;
revoke all on function public.workshop_einreichen(jsonb, boolean, boolean) from public, anon;
grant execute on function public.workshop_einreichen(jsonb, boolean, boolean) to authenticated;

-- Bearbeiten: Einreichende vor der Freigabe (danach wieder EINGEREICHT); Team mit „workshops.bearbeiten“ jederzeit
create or replace function public.workshop_bearbeiten(p_id uuid, p jsonb, p_entwurf boolean default false)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  alt workshops%rowtype;
  w workshops;
  v_team boolean := team_darf('workshops.bearbeiten');
begin
  select * into alt from workshops where id = p_id;
  if alt.id is null then raise exception 'Workshop nicht gefunden.' using errcode = 'P0001'; end if;
  if not (v_team or (alt.eingereicht_von = auth.uid() and alt.status in ('entwurf', 'eingereicht', 'abgelehnt'))) then
    raise exception 'Diesen Workshop kannst du nicht mehr bearbeiten.' using errcode = '42501';
  end if;
  w := workshop_werte(p);
  if w.bild_pfad is not null and w.bild_pfad is distinct from alt.bild_pfad and split_part(w.bild_pfad, '/', 1) <> auth.uid()::text then
    raise exception 'Das Bild konnte nicht zugeordnet werden.' using errcode = 'P0001';
  end if;
  update workshops set titel = w.titel, datum = w.datum, datum_bis = w.datum_bis, uhrzeit_von = w.uhrzeit_von, uhrzeit_bis = w.uhrzeit_bis,
    ausrichter = w.ausrichter, ort = w.ort, adresse = w.adresse, bundesland = w.bundesland, kategorie = w.kategorie,
    beschreibung = w.beschreibung, ansprechpartner = w.ansprechpartner, kontakt = w.kontakt, link = w.link, bild_pfad = w.bild_pfad,
    lat = w.lat, lng = w.lng, geaendert_am = now(),
    status = case when alt.eingereicht_von = auth.uid() and alt.status in ('entwurf', 'eingereicht', 'abgelehnt') and not (v_team and alt.status = 'freigegeben')
                  then case when coalesce(p_entwurf, false) then 'entwurf' else 'eingereicht' end
                  else alt.status end,
    ablehnungsgrund = case when alt.eingereicht_von = auth.uid() and alt.status = 'abgelehnt' then null else alt.ablehnungsgrund end
  where id = p_id;
  if v_team and alt.eingereicht_von is distinct from auth.uid() then
    perform protokollieren('workshop_bearbeitet', alt.eingereicht_von, jsonb_build_object('workshop_id', p_id, 'titel', w.titel));
  end if;
end;
$function$;
revoke all on function public.workshop_bearbeiten(uuid, jsonb, boolean) from public, anon;
grant execute on function public.workshop_bearbeiten(uuid, jsonb, boolean) to authenticated;

-- Status: freigeben / ablehnen / archivieren (Team mit jeweiligem Recht), zurueckziehen (Einreichende -> ENTWURF)
create or replace function public.workshop_status_setzen(p_id uuid, p_status text, p_grund text default null)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  alt workshops%rowtype;
  v_recht text := case p_status when 'freigegeben' then 'workshops.freigeben' when 'abgelehnt' then 'workshops.ablehnen'
                                when 'archiviert' then 'workshops.archivieren' end;
begin
  select * into alt from workshops where id = p_id;
  if alt.id is null then raise exception 'Workshop nicht gefunden.' using errcode = 'P0001'; end if;
  if p_status = 'entwurf' then
    if alt.eingereicht_von is distinct from auth.uid() or alt.status not in ('eingereicht', 'abgelehnt') then
      raise exception 'Zurückziehen ist nur vor der Freigabe möglich.' using errcode = '42501';
    end if;
    update workshops set status = 'entwurf', geaendert_am = now() where id = p_id;
    return;
  end if;
  if v_recht is null then raise exception 'Ungültiger Status.' using errcode = 'P0001'; end if;
  if not team_darf(v_recht) then raise exception 'Dafür fehlt dir das Recht.' using errcode = '42501'; end if;
  if p_status = 'abgelehnt' and char_length(btrim(coalesce(p_grund, ''))) < 3 then
    raise exception 'Bitte einen kurzen Grund für die Ablehnung angeben.' using errcode = 'P0001';
  end if;
  update workshops set status = p_status, geprueft_von = auth.uid(), geprueft_am = now(), geaendert_am = now(),
    ablehnungsgrund = case when p_status = 'abgelehnt' then left(btrim(p_grund), 1000) else null end
  where id = p_id;
  if alt.eingereicht_von is not null and alt.eingereicht_von <> auth.uid() and p_status in ('freigegeben', 'abgelehnt') then
    insert into benachrichtigungen (user_id, typ, text, link)
    values (alt.eingereicht_von, 'workshop_' || p_status,
            case when p_status = 'freigegeben' then 'Dein Workshop „' || left(alt.titel, 80) || '“ wurde freigegeben.'
                 else 'Dein Workshop „' || left(alt.titel, 80) || '“ wurde nicht freigegeben: ' || left(btrim(p_grund), 300) end,
            '/dashboard/workshops/' || p_id);
  end if;
  perform protokollieren('workshop_' || p_status, alt.eingereicht_von, jsonb_build_object('workshop_id', p_id, 'titel', alt.titel,
    'grund', case when p_status = 'abgelehnt' then left(btrim(p_grund), 300) end));
end;
$function$;
revoke all on function public.workshop_status_setzen(uuid, text, text) from public, anon;
grant execute on function public.workshop_status_setzen(uuid, text, text) to authenticated;

-- Loeschen: Einreichende vor der Freigabe; Team mit „workshops.loeschen“ jederzeit (vergangene Workshops sonst behalten)
create or replace function public.workshop_loeschen(p_id uuid)
 returns text
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  alt workshops%rowtype;
begin
  select * into alt from workshops where id = p_id;
  if alt.id is null then raise exception 'Workshop nicht gefunden.' using errcode = 'P0001'; end if;
  if not (team_darf('workshops.loeschen') or (alt.eingereicht_von = auth.uid() and alt.status in ('entwurf', 'eingereicht', 'abgelehnt'))) then
    raise exception 'Diesen Workshop kannst du nicht löschen.' using errcode = '42501';
  end if;
  delete from workshops where id = p_id;
  if alt.eingereicht_von is distinct from auth.uid() then
    perform protokollieren('workshop_geloescht', alt.eingereicht_von, jsonb_build_object('workshop_id', p_id, 'titel', alt.titel));
  end if;
  return alt.bild_pfad;
end;
$function$;
revoke all on function public.workshop_loeschen(uuid) from public, anon;
grant execute on function public.workshop_loeschen(uuid) to authenticated;

-- Pruefliste fuer Admin/Team (mit einreichender Person als @Nutzername)
create or replace function public.workshops_pruefen()
 returns table(id uuid, titel text, datum date, ort text, bundesland text, status text, erstellt_am timestamptz, eingereicht_von text)
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
begin
  if not (team_darf('workshops.ansehen') or team_darf('workshops.freigeben') or team_darf('workshops.ablehnen') or team_darf('workshops.bearbeiten')) then
    raise exception 'Dafür fehlt dir das Recht.' using errcode = '42501';
  end if;
  return query
  select w.id, w.titel, w.datum, w.ort, w.bundesland, w.status, w.erstellt_am, '@' || p.handle
  from workshops w left join profiles p on p.id = w.eingereicht_von
  where w.status in ('eingereicht', 'abgelehnt', 'entwurf')
  order by w.status = 'eingereicht' desc, w.erstellt_am;
end;
$function$;
revoke all on function public.workshops_pruefen() from public, anon;
grant execute on function public.workshops_pruefen() to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('workshops', 'workshops', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];
drop policy if exists "Workshop-Bilder lesen" on storage.objects;
create policy "Workshop-Bilder lesen" on storage.objects for select to authenticated
  using (bucket_id = 'workshops' and exists (select 1 from public.workshops w where w.bild_pfad = name));
drop policy if exists "Workshop-Bilder hochladen" on storage.objects;
create policy "Workshop-Bilder hochladen" on storage.objects for insert to authenticated
  with check (bucket_id = 'workshops' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "Workshop-Bilder loeschen" on storage.objects;
create policy "Workshop-Bilder loeschen" on storage.objects for delete to authenticated
  using (bucket_id = 'workshops' and ((storage.foldername(name))[1] = auth.uid()::text or public.team_darf('workshops.loeschen')));

-- =============================================================================================
-- 2) TanzRaum Treff
-- =============================================================================================
create table if not exists public.treff_kategorien (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(btrim(name)) between 2 and 60),
  emoji text check (char_length(emoji) <= 8),
  beschreibung text check (char_length(beschreibung) <= 200),
  sortierung integer not null default 100,
  aktiv boolean not null default true,
  erstellt_am timestamptz not null default now()
);
insert into public.treff_kategorien (name, emoji, beschreibung, sortierung) values
  ('Tanz & Training', '💃', 'Technik, Übungen, Trainingsplanung', 10),
  ('Musik', '🎵', 'Musikauswahl, Schnitt, Rechte', 20),
  ('Turniere', '🏆', 'Turniere, Ausschreibungen, Erfahrungen', 30),
  ('Kostüme', '👗', 'Kostüme, Requisiten, Pflege', 40),
  ('Schautanz', '🎭', 'Ideen, Themen, Umsetzung', 50),
  ('Akrobatik', '🤸', 'Hebungen, Sprünge, Sicherheit', 60),
  ('Nachwuchs', '👧', 'Kinder- und Jugendtanz, Eltern', 70),
  ('Trainer', '👨‍🏫', 'Austausch unter Trainerinnen und Trainern', 80),
  ('Verein', '🏠', 'Organisation, Ehrenamt, Vereinsleben', 90),
  ('Regeln & Wertung', '📋', 'Turnierordnung, Wertung, Jury', 100),
  ('Allgemeiner Austausch', '💬', 'Alles rund um den karnevalistischen Tanzsport', 110)
on conflict (name) do nothing;

create table if not exists public.treff_themen (
  id uuid primary key default gen_random_uuid(),
  kategorie_id uuid not null references public.treff_kategorien(id) on delete restrict,
  autor_id uuid references public.profiles(id) on delete set null,
  titel text not null check (char_length(btrim(titel)) between 5 and 160),
  inhalt text not null check (char_length(btrim(inhalt)) between 1 and 10000),
  link text check (link is null or (link ~ '^https?://\S+$' and char_length(link) <= 500)),
  bild_pfad text check (bild_pfad is null or bild_pfad ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$'),
  datei_pfad text check (datei_pfad is null or datei_pfad ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.pdf$'),
  datei_name text check (char_length(datei_name) <= 120),
  erstellt_am timestamptz not null default now(),
  bearbeitet_am timestamptz,
  letzte_aktivitaet timestamptz not null default now(),
  antworten integer not null default 0,
  angepinnt boolean not null default false,
  geschlossen boolean not null default false,
  empfohlen boolean not null default false,
  beste_antwort_id uuid,
  geloescht_am timestamptz,
  geloescht_von uuid references public.profiles(id) on delete set null,
  suchtext tsvector generated always as (to_tsvector('german', coalesce(titel, '') || ' ' || coalesce(inhalt, ''))) stored
);
create index if not exists treff_themen_aktivitaet on public.treff_themen (letzte_aktivitaet desc) where geloescht_am is null;
create index if not exists treff_themen_kategorie on public.treff_themen (kategorie_id, letzte_aktivitaet desc) where geloescht_am is null;
create index if not exists treff_themen_autor on public.treff_themen (autor_id);
create index if not exists treff_themen_suche on public.treff_themen using gin (suchtext);

create table if not exists public.treff_beitraege (
  id uuid primary key default gen_random_uuid(),
  thema_id uuid not null references public.treff_themen(id) on delete cascade,
  autor_id uuid references public.profiles(id) on delete set null,
  inhalt text not null check (char_length(btrim(inhalt)) between 1 and 10000),
  bild_pfad text check (bild_pfad is null or bild_pfad ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$'),
  erstellt_am timestamptz not null default now(),
  bearbeitet_am timestamptz,
  empfohlen boolean not null default false,
  geloescht_am timestamptz,
  geloescht_von uuid references public.profiles(id) on delete set null
);
create index if not exists treff_beitraege_thema on public.treff_beitraege (thema_id, erstellt_am);
create index if not exists treff_beitraege_autor on public.treff_beitraege (autor_id);
alter table public.treff_themen drop constraint if exists treff_themen_beste_antwort_fk;
alter table public.treff_themen add constraint treff_themen_beste_antwort_fk foreign key (beste_antwort_id) references public.treff_beitraege(id) on delete set null;

create table if not exists public.treff_hilfreich (
  beitrag_id uuid not null references public.treff_beitraege(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  erstellt_am timestamptz not null default now(),
  primary key (beitrag_id, user_id)
);
create table if not exists public.treff_abos (
  thema_id uuid not null references public.treff_themen(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  erstellt_am timestamptz not null default now(),
  primary key (thema_id, user_id)
);
create index if not exists treff_abos_user on public.treff_abos (user_id);
create table if not exists public.treff_sperren (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  bis timestamptz,
  grund text check (char_length(grund) <= 500),
  gesperrt_von uuid references public.profiles(id) on delete set null,
  erstellt_am timestamptz not null default now()
);
comment on table public.treff_sperren is 'Sperre fuer das Schreiben im TanzRaum Treff (bis NULL = unbefristet); Lesen bleibt moeglich';

alter table public.meldungen add column if not exists treff_thema_id uuid references public.treff_themen(id) on delete set null;
alter table public.meldungen add column if not exists treff_beitrag_id uuid references public.treff_beitraege(id) on delete set null;

-- RLS: lesen fuer alle Angemeldeten (nicht geloeschte Inhalte), schreiben nur ueber Funktionen
alter table public.treff_kategorien enable row level security;
alter table public.treff_themen enable row level security;
alter table public.treff_beitraege enable row level security;
alter table public.treff_hilfreich enable row level security;
alter table public.treff_abos enable row level security;
alter table public.treff_sperren enable row level security;
drop policy if exists "Treff-Kategorien lesen" on public.treff_kategorien;
create policy "Treff-Kategorien lesen" on public.treff_kategorien for select to authenticated using (true);
drop policy if exists "Treff-Themen lesen" on public.treff_themen;
create policy "Treff-Themen lesen" on public.treff_themen for select to authenticated using (geloescht_am is null);
drop policy if exists "Treff-Beitraege lesen" on public.treff_beitraege;
create policy "Treff-Beitraege lesen" on public.treff_beitraege for select to authenticated using (geloescht_am is null);
drop policy if exists "Eigene Treff-Abos" on public.treff_abos;
create policy "Eigene Treff-Abos" on public.treff_abos for select to authenticated using (user_id = auth.uid());
drop policy if exists "Eigene Treff-Sperre" on public.treff_sperren;
create policy "Eigene Treff-Sperre" on public.treff_sperren for select to authenticated using (user_id = auth.uid() or team_darf('treff.nutzer_sperren'));
revoke all on public.treff_kategorien, public.treff_themen, public.treff_beitraege, public.treff_hilfreich, public.treff_abos, public.treff_sperren
  from public, anon, authenticated;
grant select on public.treff_kategorien, public.treff_themen, public.treff_beitraege, public.treff_abos, public.treff_sperren to authenticated;
grant all on public.treff_kategorien, public.treff_themen, public.treff_beitraege, public.treff_hilfreich, public.treff_abos, public.treff_sperren
  to service_role;

-- Darf diese Person im Treff schreiben? BASIC oder Vereinslizenz, ab 16 Jahren, nicht gesperrt (Konto und Treff)
create or replace function public.treff_darf_schreiben(p_user_id uuid default auth.uid())
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select p_user_id is not null
    and exists (select 1 from profiles p where p.id = p_user_id and not coalesce(p.gesperrt, false))
    and not ist_unter_16(p_user_id)
    and coalesce(tarif_von(p_user_id), 'free') in ('basic', 'verein')
    and not exists (select 1 from treff_sperren s where s.user_id = p_user_id and (s.bis is null or s.bis > now()));
$function$;
revoke all on function public.treff_darf_schreiben(uuid) from public, anon;
grant execute on function public.treff_darf_schreiben(uuid) to authenticated;

-- Status fuer die App (Hinweis „Mitdiskutieren mit TanzRaum BASIC“ etc.)
create or replace function public.treff_mein_status()
 returns jsonb
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select jsonb_build_object(
    'schreiben', treff_darf_schreiben(auth.uid()),
    'tarif', coalesce(tarif_von(auth.uid()), 'free'),
    'unter_16', ist_unter_16(auth.uid()),
    'gesperrt_bis', (select coalesce(s.bis::text, 'unbefristet') from treff_sperren s where s.user_id = auth.uid() and (s.bis is null or s.bis > now())),
    'themen_erstellen_team', team_darf('treff.themen_erstellen'),
    'admin', ist_plattform_admin_aktuell(),
    'rechte', (select coalesce(jsonb_agg(r), '[]'::jsonb) from unnest(team_rechte_katalog()) r where r like 'treff.%' and team_darf(r)));
$function$;
revoke all on function public.treff_mein_status() from public, anon;
grant execute on function public.treff_mein_status() to authenticated;

-- Themenliste: p_ansicht 'kategorie' (angepinnt zuerst, dann Aktivitaet), 'aktuell' (mit Antworten, nach Aktivitaet),
-- 'neu' (nach Erstellung), 'angepinnt'; p_q = Suche (Titel/Inhalt)
create or replace function public.treff_themen_liste(p_kategorie uuid default null, p_ansicht text default 'kategorie', p_q text default null,
                                                     p_limit integer default 30, p_offset integer default 0)
 returns table(id uuid, kategorie_id uuid, kategorie text, kategorie_emoji text, titel text, auszug text, autor_id uuid,
               autor_handle text, autor_avatar text, autor_verein text, autor_kennzeichen text, erstellt_am timestamptz,
               bearbeitet_am timestamptz, letzte_aktivitaet timestamptz, antworten integer, angepinnt boolean, geschlossen boolean,
               empfohlen boolean, beantwortet boolean)
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  v_q text := nullif(btrim(coalesce(p_q, '')), '');
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet.' using errcode = '42501'; end if;
  return query
  select t.id, t.kategorie_id, k.name, k.emoji, t.titel, left(regexp_replace(t.inhalt, '\s+', ' ', 'g'), 180), t.autor_id,
    a.handle, a.avatar_url, a.verein, a.kennzeichen, t.erstellt_am, t.bearbeitet_am, t.letzte_aktivitaet, t.antworten,
    t.angepinnt, t.geschlossen, t.empfohlen, t.beste_antwort_id is not null
  from treff_themen t
  join treff_kategorien k on k.id = t.kategorie_id
  left join lateral (select * from community_autoren(array[t.autor_id])) a on true
  where t.geloescht_am is null
    and (p_kategorie is null or t.kategorie_id = p_kategorie)
    and (p_ansicht <> 'aktuell' or t.antworten > 0)
    and (p_ansicht <> 'angepinnt' or t.angepinnt)
    and (v_q is null or t.suchtext @@ websearch_to_tsquery('german', v_q) or t.titel ilike '%' || v_q || '%')
  order by
    case when p_ansicht = 'kategorie' then t.angepinnt end desc nulls last,
    case when p_ansicht = 'neu' then t.erstellt_am end desc nulls last,
    case when v_q is not null then ts_rank(t.suchtext, websearch_to_tsquery('german', v_q)) end desc nulls last,
    t.letzte_aktivitaet desc
  limit greatest(1, least(coalesce(p_limit, 30), 100)) offset greatest(0, coalesce(p_offset, 0));
end;
$function$;
revoke all on function public.treff_themen_liste(uuid, text, text, integer, integer) from public, anon;
grant execute on function public.treff_themen_liste(uuid, text, text, integer, integer) to authenticated;

-- Kategorien mit Anzahl Themen (aktive fuer alle, inaktive nur fuer den Admin)
create or replace function public.treff_kategorien_liste()
 returns table(id uuid, name text, emoji text, beschreibung text, sortierung integer, aktiv boolean, themen integer, letzte_aktivitaet timestamptz)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select k.id, k.name, k.emoji, k.beschreibung, k.sortierung, k.aktiv,
    (select count(*)::int from treff_themen t where t.kategorie_id = k.id and t.geloescht_am is null),
    (select max(t.letzte_aktivitaet) from treff_themen t where t.kategorie_id = k.id and t.geloescht_am is null)
  from treff_kategorien k
  where auth.uid() is not null and (k.aktiv or ist_plattform_admin_aktuell())
  order by k.sortierung, k.name;
$function$;
revoke all on function public.treff_kategorien_liste() from public, anon;
grant execute on function public.treff_kategorien_liste() to authenticated;

-- Thema mit allen Beitraegen und den Rechten der ansehenden Person (nur Anzeige – jede Aktion prueft erneut)
create or replace function public.treff_thema(p_id uuid)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  t treff_themen%rowtype;
  v_ich uuid := auth.uid();
begin
  if v_ich is null then raise exception 'Nicht angemeldet.' using errcode = '42501'; end if;
  select * into t from treff_themen where id = p_id and geloescht_am is null;
  if t.id is null then return null; end if;
  return jsonb_build_object(
    'id', t.id, 'titel', t.titel, 'inhalt', t.inhalt, 'link', t.link, 'bild_pfad', t.bild_pfad, 'datei_pfad', t.datei_pfad,
    'datei_name', t.datei_name, 'erstellt_am', t.erstellt_am, 'bearbeitet_am', t.bearbeitet_am, 'letzte_aktivitaet', t.letzte_aktivitaet,
    'antworten', t.antworten, 'angepinnt', t.angepinnt, 'geschlossen', t.geschlossen, 'empfohlen', t.empfohlen,
    'beste_antwort_id', t.beste_antwort_id, 'kategorie_id', t.kategorie_id,
    'kategorie', (select jsonb_build_object('name', k.name, 'emoji', k.emoji) from treff_kategorien k where k.id = t.kategorie_id),
    'autor', (select to_jsonb(a) from community_autoren(array[t.autor_id]) a),
    'ich_autor', t.autor_id = v_ich,
    'ich_folge', exists (select 1 from treff_abos x where x.thema_id = t.id and x.user_id = v_ich),
    'darf_schreiben', treff_darf_schreiben(v_ich),
    'wissen', (select jsonb_agg(jsonb_build_object('id', w.id, 'titel', w.titel)) from wissen_artikel w
               where w.treff_thema_id = t.id and w.status = 'veroeffentlicht'),
    'beitraege', coalesce((select jsonb_agg(jsonb_build_object(
        'id', b.id, 'inhalt', b.inhalt, 'bild_pfad', b.bild_pfad, 'erstellt_am', b.erstellt_am, 'bearbeitet_am', b.bearbeitet_am,
        'empfohlen', b.empfohlen, 'ich_autor', b.autor_id = v_ich,
        'autor', (select to_jsonb(a) from community_autoren(array[b.autor_id]) a),
        'hilfreich', (select count(*) from treff_hilfreich h where h.beitrag_id = b.id),
        'ich_hilfreich', exists (select 1 from treff_hilfreich h where h.beitrag_id = b.id and h.user_id = v_ich))
        order by b.erstellt_am)
      from treff_beitraege b where b.thema_id = t.id and b.geloescht_am is null), '[]'::jsonb));
end;
$function$;
revoke all on function public.treff_thema(uuid) from public, anon;
grant execute on function public.treff_thema(uuid) to authenticated;

-- Aehnliche Themen beim Erstellen (einfache Wortsuche, Ziel: weniger doppelte Themen)
create or replace function public.treff_aehnliche(p_titel text)
 returns table(id uuid, titel text, antworten integer, kategorie text)
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  v_woerter text;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet.' using errcode = '42501'; end if;
  select string_agg(distinct w[1], ' | ') into v_woerter
  from regexp_matches(lower(coalesce(p_titel, '')), '([a-z0-9äöüß]{4,})', 'g') as w;
  if v_woerter is null then return; end if;
  return query
  select t.id, t.titel, t.antworten, k.name
  from treff_themen t join treff_kategorien k on k.id = t.kategorie_id
  where t.geloescht_am is null and t.suchtext @@ to_tsquery('german', v_woerter)
  order by ts_rank(t.suchtext, to_tsquery('german', v_woerter)) desc, t.letzte_aktivitaet desc
  limit 5;
end;
$function$;
revoke all on function public.treff_aehnliche(text) from public, anon;
grant execute on function public.treff_aehnliche(text) to authenticated;

-- Pfade fuer Bilder/Dateien im Treff: <user_id>/<uuid>.<endung>
create or replace function public.treff_pfad_ok(p_pfad text)
 returns boolean
 language sql
 stable
 set search_path to 'public'
as $function$
  select p_pfad is null or split_part(p_pfad, '/', 1) = auth.uid()::text;
$function$;

-- Neues Thema (BASIC/VEREIN ab 16; Team mit „treff.themen_erstellen“ auch ohne BASIC). Autor folgt automatisch.
create or replace function public.treff_thema_erstellen(p_kategorie uuid, p_titel text, p_inhalt text, p_link text default null,
                                                        p_bild_pfad text default null, p_datei_pfad text default null, p_datei_name text default null)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_id uuid;
begin
  if not (treff_darf_schreiben(auth.uid())
          or (team_darf('treff.themen_erstellen') and not ist_unter_16(auth.uid())
              and not exists (select 1 from treff_sperren s where s.user_id = auth.uid() and (s.bis is null or s.bis > now())))) then
    raise exception 'Mitdiskutieren mit TanzRaum BASIC.' using errcode = '42501';
  end if;
  if not exists (select 1 from treff_kategorien k where k.id = p_kategorie and k.aktiv) then
    raise exception 'Bitte eine Kategorie auswählen.' using errcode = 'P0001';
  end if;
  if not (treff_pfad_ok(p_bild_pfad) and treff_pfad_ok(p_datei_pfad)) then raise exception 'Die Datei konnte nicht zugeordnet werden.' using errcode = 'P0001'; end if;
  if (select count(*) from treff_themen t where t.autor_id = auth.uid() and t.erstellt_am > now() - interval '1 day') >= 15 then
    raise exception 'Du hast heute schon viele Themen erstellt. Bitte versuche es morgen erneut.' using errcode = 'P0001';
  end if;
  insert into treff_themen (kategorie_id, autor_id, titel, inhalt, link, bild_pfad, datei_pfad, datei_name)
  values (p_kategorie, auth.uid(), btrim(p_titel), btrim(p_inhalt), nullif(btrim(coalesce(p_link, '')), ''), p_bild_pfad, p_datei_pfad,
          case when p_datei_pfad is null then null else nullif(left(btrim(coalesce(p_datei_name, '')), 120), '') end)
  returning id into v_id;
  insert into treff_abos (thema_id, user_id) values (v_id, auth.uid()) on conflict do nothing;
  return v_id;
end;
$function$;
revoke all on function public.treff_thema_erstellen(uuid, text, text, text, text, text, text) from public, anon;
grant execute on function public.treff_thema_erstellen(uuid, text, text, text, text, text, text) to authenticated;

-- Thema bearbeiten: Autor (solange schreibberechtigt) oder Team mit „treff.themen_bearbeiten“
create or replace function public.treff_thema_bearbeiten(p_id uuid, p_titel text, p_inhalt text, p_link text default null)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  t treff_themen%rowtype;
begin
  select * into t from treff_themen where id = p_id and geloescht_am is null;
  if t.id is null then raise exception 'Thema nicht gefunden.' using errcode = 'P0001'; end if;
  if not ((t.autor_id = auth.uid() and treff_darf_schreiben(auth.uid())) or team_darf('treff.themen_bearbeiten')) then
    raise exception 'Dieses Thema kannst du nicht bearbeiten.' using errcode = '42501';
  end if;
  update treff_themen set titel = btrim(p_titel), inhalt = btrim(p_inhalt), link = nullif(btrim(coalesce(p_link, '')), ''), bearbeitet_am = now()
  where id = p_id;
  if t.autor_id is distinct from auth.uid() then
    perform protokollieren('treff_thema_bearbeitet', t.autor_id, jsonb_build_object('thema_id', p_id, 'titel', t.titel));
  end if;
end;
$function$;
revoke all on function public.treff_thema_bearbeiten(uuid, text, text, text) from public, anon;
grant execute on function public.treff_thema_bearbeiten(uuid, text, text, text) to authenticated;

-- Thema loeschen (weich): Autor oder Team mit „treff.themen_loeschen“
create or replace function public.treff_thema_loeschen(p_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  t treff_themen%rowtype;
begin
  select * into t from treff_themen where id = p_id and geloescht_am is null;
  if t.id is null then raise exception 'Thema nicht gefunden.' using errcode = 'P0001'; end if;
  if not (t.autor_id = auth.uid() or team_darf('treff.themen_loeschen')) then
    raise exception 'Dieses Thema kannst du nicht löschen.' using errcode = '42501';
  end if;
  update treff_themen set geloescht_am = now(), geloescht_von = auth.uid(), angepinnt = false where id = p_id;
  if t.autor_id is distinct from auth.uid() then
    perform protokollieren('treff_thema_geloescht', t.autor_id, jsonb_build_object('thema_id', p_id, 'titel', t.titel));
  end if;
end;
$function$;
revoke all on function public.treff_thema_loeschen(uuid) from public, anon;
grant execute on function public.treff_thema_loeschen(uuid) to authenticated;

-- Antworten: BASIC/VEREIN ab 16, nicht bei geschlossenem Thema. Folgende werden benachrichtigt (Glocke).
create or replace function public.treff_antworten(p_thema_id uuid, p_inhalt text, p_bild_pfad text default null)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  t treff_themen%rowtype;
  v_id uuid;
  v_text text;
begin
  if not treff_darf_schreiben(auth.uid()) then raise exception 'Mitdiskutieren mit TanzRaum BASIC.' using errcode = '42501'; end if;
  select * into t from treff_themen where id = p_thema_id and geloescht_am is null;
  if t.id is null then raise exception 'Thema nicht gefunden.' using errcode = 'P0001'; end if;
  if t.geschlossen then raise exception 'Dieses Thema ist geschlossen.' using errcode = 'P0001'; end if;
  if not treff_pfad_ok(p_bild_pfad) then raise exception 'Das Bild konnte nicht zugeordnet werden.' using errcode = 'P0001'; end if;
  if (select count(*) from treff_beitraege b where b.autor_id = auth.uid() and b.erstellt_am > now() - interval '1 hour') >= 60 then
    raise exception 'Du hast in kurzer Zeit sehr viele Antworten geschrieben. Bitte warte einen Moment.' using errcode = 'P0001';
  end if;
  insert into treff_beitraege (thema_id, autor_id, inhalt, bild_pfad) values (p_thema_id, auth.uid(), btrim(p_inhalt), p_bild_pfad)
  returning id into v_id;
  update treff_themen set antworten = antworten + 1, letzte_aktivitaet = now() where id = p_thema_id;
  -- Benachrichtigung an alle, die dem Thema folgen (nicht an sich selbst; keine doppelte ungelesene Meldung)
  v_text := 'Neue Antwort im TanzRaum Treff: „' || left(t.titel, 80) || '“';
  insert into benachrichtigungen (user_id, typ, text, link)
  select a.user_id, 'treff_antwort', v_text, '/dashboard/treff/thema/' || p_thema_id
  from treff_abos a
  where a.thema_id = p_thema_id and a.user_id <> auth.uid()
    and not exists (select 1 from benachrichtigungen b where b.user_id = a.user_id and b.typ = 'treff_antwort'
                    and b.link = '/dashboard/treff/thema/' || p_thema_id and not b.gelesen);
  return v_id;
end;
$function$;
revoke all on function public.treff_antworten(uuid, text, text) from public, anon;
grant execute on function public.treff_antworten(uuid, text, text) to authenticated;

create or replace function public.treff_beitrag_bearbeiten(p_id uuid, p_inhalt text)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  b treff_beitraege%rowtype;
begin
  select * into b from treff_beitraege where id = p_id and geloescht_am is null;
  if b.id is null then raise exception 'Beitrag nicht gefunden.' using errcode = 'P0001'; end if;
  if not ((b.autor_id = auth.uid() and treff_darf_schreiben(auth.uid())) or team_darf('treff.beitraege_bearbeiten')) then
    raise exception 'Diesen Beitrag kannst du nicht bearbeiten.' using errcode = '42501';
  end if;
  update treff_beitraege set inhalt = btrim(p_inhalt), bearbeitet_am = now() where id = p_id;
  if b.autor_id is distinct from auth.uid() then
    perform protokollieren('treff_beitrag_bearbeitet', b.autor_id, jsonb_build_object('beitrag_id', p_id, 'thema_id', b.thema_id));
  end if;
end;
$function$;
revoke all on function public.treff_beitrag_bearbeiten(uuid, text) from public, anon;
grant execute on function public.treff_beitrag_bearbeiten(uuid, text) to authenticated;

create or replace function public.treff_beitrag_loeschen(p_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  b treff_beitraege%rowtype;
begin
  select * into b from treff_beitraege where id = p_id and geloescht_am is null;
  if b.id is null then raise exception 'Beitrag nicht gefunden.' using errcode = 'P0001'; end if;
  if not (b.autor_id = auth.uid() or team_darf('treff.beitraege_loeschen')) then
    raise exception 'Diesen Beitrag kannst du nicht löschen.' using errcode = '42501';
  end if;
  update treff_beitraege set geloescht_am = now(), geloescht_von = auth.uid() where id = p_id;
  update treff_themen set antworten = greatest(0, antworten - 1),
    beste_antwort_id = case when beste_antwort_id = p_id then null else beste_antwort_id end
  where id = b.thema_id;
  if b.autor_id is distinct from auth.uid() then
    perform protokollieren('treff_beitrag_geloescht', b.autor_id, jsonb_build_object('beitrag_id', p_id, 'thema_id', b.thema_id));
  end if;
end;
$function$;
revoke all on function public.treff_beitrag_loeschen(uuid) from public, anon;
grant execute on function public.treff_beitrag_loeschen(uuid) to authenticated;

-- 👍 Hilfreich (BASIC/VEREIN, nicht fuer eigene Beitraege)
create or replace function public.treff_hilfreich_setzen(p_beitrag_id uuid, p_an boolean)
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if not treff_darf_schreiben(auth.uid()) then raise exception 'Mitdiskutieren mit TanzRaum BASIC.' using errcode = '42501'; end if;
  if not exists (select 1 from treff_beitraege b where b.id = p_beitrag_id and b.geloescht_am is null and b.autor_id is distinct from auth.uid()) then
    raise exception 'Das ist hier nicht möglich.' using errcode = 'P0001';
  end if;
  if p_an then insert into treff_hilfreich (beitrag_id, user_id) values (p_beitrag_id, auth.uid()) on conflict do nothing;
  else delete from treff_hilfreich where beitrag_id = p_beitrag_id and user_id = auth.uid(); end if;
  return (select count(*)::int from treff_hilfreich h where h.beitrag_id = p_beitrag_id);
end;
$function$;
revoke all on function public.treff_hilfreich_setzen(uuid, boolean) from public, anon;
grant execute on function public.treff_hilfreich_setzen(uuid, boolean) to authenticated;

-- ✓ Beste Antwort: Ersteller des Themas oder TanzRaum-Admin (NULL entfernt die Markierung)
create or replace function public.treff_beste_antwort(p_thema_id uuid, p_beitrag_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  t treff_themen%rowtype;
begin
  select * into t from treff_themen where id = p_thema_id and geloescht_am is null;
  if t.id is null then raise exception 'Thema nicht gefunden.' using errcode = 'P0001'; end if;
  if not (t.autor_id = auth.uid() or ist_plattform_admin_aktuell()) then
    raise exception 'Die beste Antwort wählt, wer das Thema erstellt hat.' using errcode = '42501';
  end if;
  if p_beitrag_id is not null and not exists (select 1 from treff_beitraege b where b.id = p_beitrag_id and b.thema_id = p_thema_id and b.geloescht_am is null) then
    raise exception 'Antwort nicht gefunden.' using errcode = 'P0001';
  end if;
  update treff_themen set beste_antwort_id = p_beitrag_id where id = p_thema_id;
end;
$function$;
revoke all on function public.treff_beste_antwort(uuid, uuid) from public, anon;
grant execute on function public.treff_beste_antwort(uuid, uuid) to authenticated;

-- ⭐ TanzRaum empfiehlt (Thema oder Beitrag): Admin bzw. Team mit „treff.empfehlen“
create or replace function public.treff_empfehlen(p_thema_id uuid, p_beitrag_id uuid, p_an boolean)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if not team_darf('treff.empfehlen') then raise exception 'Dafür fehlt dir das Recht.' using errcode = '42501'; end if;
  if p_beitrag_id is not null then
    update treff_beitraege set empfohlen = coalesce(p_an, false) where id = p_beitrag_id and geloescht_am is null;
  else
    update treff_themen set empfohlen = coalesce(p_an, false) where id = p_thema_id and geloescht_am is null;
  end if;
  if not found then raise exception 'Nicht gefunden.' using errcode = 'P0001'; end if;
end;
$function$;
revoke all on function public.treff_empfehlen(uuid, uuid, boolean) from public, anon;
grant execute on function public.treff_empfehlen(uuid, uuid, boolean) to authenticated;

-- 🔔 Thema folgen (BASIC/VEREIN)
create or replace function public.treff_folgen(p_thema_id uuid, p_an boolean)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if p_an and not treff_darf_schreiben(auth.uid()) then raise exception 'Themen folgen kannst du mit TanzRaum BASIC.' using errcode = '42501'; end if;
  if p_an then
    if not exists (select 1 from treff_themen t where t.id = p_thema_id and t.geloescht_am is null) then
      raise exception 'Thema nicht gefunden.' using errcode = 'P0001';
    end if;
    insert into treff_abos (thema_id, user_id) values (p_thema_id, auth.uid()) on conflict do nothing;
  else
    delete from treff_abos where thema_id = p_thema_id and user_id = auth.uid();
  end if;
end;
$function$;
revoke all on function public.treff_folgen(uuid, boolean) from public, anon;
grant execute on function public.treff_folgen(uuid, boolean) to authenticated;

-- Moderation am Thema: schliessen, oeffnen, anpinnen, entpinnen, verschieben – jeweils mit eigenem Team-Recht
create or replace function public.treff_moderieren(p_thema_id uuid, p_aktion text, p_kategorie uuid default null)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  t treff_themen%rowtype;
  v_recht text := case p_aktion when 'schliessen' then 'treff.themen_schliessen' when 'oeffnen' then 'treff.themen_oeffnen'
                                when 'anpinnen' then 'treff.themen_anpinnen' when 'entpinnen' then 'treff.themen_entpinnen'
                                when 'verschieben' then 'treff.themen_verschieben' end;
begin
  if v_recht is null then raise exception 'Unbekannte Aktion.' using errcode = 'P0001'; end if;
  if not team_darf(v_recht) then raise exception 'Dafür fehlt dir das Recht.' using errcode = '42501'; end if;
  select * into t from treff_themen where id = p_thema_id and geloescht_am is null;
  if t.id is null then raise exception 'Thema nicht gefunden.' using errcode = 'P0001'; end if;
  if p_aktion = 'verschieben' then
    if not exists (select 1 from treff_kategorien k where k.id = p_kategorie) then raise exception 'Kategorie nicht gefunden.' using errcode = 'P0001'; end if;
    update treff_themen set kategorie_id = p_kategorie where id = p_thema_id;
  else
    update treff_themen set
      geschlossen = case p_aktion when 'schliessen' then true when 'oeffnen' then false else geschlossen end,
      angepinnt = case p_aktion when 'anpinnen' then true when 'entpinnen' then false else angepinnt end
    where id = p_thema_id;
  end if;
  perform protokollieren('treff_thema_' || p_aktion, t.autor_id, jsonb_build_object('thema_id', p_thema_id, 'titel', t.titel,
    'kategorie_vorher', case when p_aktion = 'verschieben' then t.kategorie_id end, 'kategorie', p_kategorie));
end;
$function$;
revoke all on function public.treff_moderieren(uuid, text, uuid) from public, anon;
grant execute on function public.treff_moderieren(uuid, text, uuid) to authenticated;

-- Melden: Thema, Beitrag oder Person – jede angemeldete Person (auch FREE). Loest keine Sanktion aus.
create or replace function public.treff_melden(p_art text, p_id uuid, p_grund text, p_text text)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_ziel uuid;
  v_thema uuid;
  v_beitrag uuid;
begin
  if auth.uid() is null or exists (select 1 from profiles x where x.id = auth.uid() and coalesce(x.gesperrt, false)) then
    raise exception 'Nicht angemeldet.' using errcode = '42501';
  end if;
  if p_grund not in ('spam', 'beleidigung', 'unangemessen', 'werbung', 'problematisch', 'jugendgefaehrdend', 'sonstiges') then
    raise exception 'Bitte einen Grund auswählen.' using errcode = 'P0001';
  end if;
  if p_art = 'thema' then
    select t.autor_id, t.id into v_ziel, v_thema from treff_themen t where t.id = p_id and t.geloescht_am is null;
    if v_thema is null then raise exception 'Thema nicht gefunden.' using errcode = 'P0001'; end if;
  elsif p_art = 'beitrag' then
    select b.autor_id, b.thema_id, b.id into v_ziel, v_thema, v_beitrag from treff_beitraege b where b.id = p_id and b.geloescht_am is null;
    if v_beitrag is null then raise exception 'Beitrag nicht gefunden.' using errcode = 'P0001'; end if;
  elsif p_art = 'nutzer' then
    select p.id into v_ziel from profiles p where p.id = p_id;
    if v_ziel is null then raise exception 'Person nicht gefunden.' using errcode = 'P0001'; end if;
  else
    raise exception 'Unbekannte Meldung.' using errcode = 'P0001';
  end if;
  if v_ziel = auth.uid() then raise exception 'Eigene Inhalte kannst du nicht melden.' using errcode = 'P0001'; end if;
  if (select count(*) from meldungen m where m.melder_id = auth.uid() and m.erstellt_am > now() - interval '1 day') >= 20 then
    raise exception 'Du hast heute schon sehr viele Meldungen abgeschickt. Bitte versuche es morgen erneut.' using errcode = 'P0001';
  end if;
  if exists (select 1 from meldungen m where m.melder_id = auth.uid() and m.status in ('offen', 'in_pruefung') and m.bereich = 'treff'
             and m.treff_thema_id is not distinct from case when p_art = 'nutzer' then null else v_thema end
             and m.treff_beitrag_id is not distinct from v_beitrag and m.ziel_user_id is not distinct from v_ziel) then
    raise exception 'Du hast das bereits gemeldet – wir kümmern uns darum.' using errcode = 'P0001';
  end if;
  insert into meldungen (melder_id, ziel_user_id, grund, text, bereich, treff_thema_id, treff_beitrag_id)
  values (auth.uid(), v_ziel, p_grund, nullif(left(btrim(coalesce(p_text, '')), 1000), ''), 'treff',
          case when p_art = 'nutzer' then null else v_thema end, v_beitrag);
end;
$function$;
revoke all on function public.treff_melden(text, uuid, text, text) from public, anon;
grant execute on function public.treff_melden(text, uuid, text, text) to authenticated;

-- Treff-Meldungen fuer die Moderation (ohne meldende Person – wie bei der Boerse)
create or replace function public.treff_meldungen(p_status text default null)
 returns table(id uuid, grund text, text text, status text, erstellt_am timestamptz, art text, thema_id uuid, thema_titel text,
               beitrag_id uuid, auszug text, ziel_user_id uuid, ziel_handle text, ziel_treff_gesperrt boolean, admin_notiz text,
               bearbeitet_am timestamptz, anzahl_zum_ziel integer)
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
begin
  if not team_darf('treff.meldungen_bearbeiten') then raise exception 'Dafür fehlt dir das Recht.' using errcode = '42501'; end if;
  return query
  select m.id, m.grund, m.text, m.status, m.erstellt_am,
    case when m.treff_beitrag_id is not null then 'beitrag' when m.treff_thema_id is not null then 'thema' else 'nutzer' end,
    m.treff_thema_id, t.titel, m.treff_beitrag_id,
    left(regexp_replace(coalesce(b.inhalt, t.inhalt, ''), '\s+', ' ', 'g'), 240),
    m.ziel_user_id, (select '@' || p.handle from profiles p where p.id = m.ziel_user_id),
    exists (select 1 from treff_sperren s where s.user_id = m.ziel_user_id and (s.bis is null or s.bis > now())),
    m.admin_notiz, m.bearbeitet_am,
    (select count(*)::int from meldungen x where x.ziel_user_id = m.ziel_user_id and x.bereich = 'treff')
  from meldungen m
  left join treff_themen t on t.id = m.treff_thema_id
  left join treff_beitraege b on b.id = m.treff_beitrag_id
  where m.bereich = 'treff' and (p_status is null or m.status = p_status)
  order by (m.status in ('offen', 'in_pruefung')) desc, m.erstellt_am desc
  limit 200;
end;
$function$;
revoke all on function public.treff_meldungen(text) from public, anon;
grant execute on function public.treff_meldungen(text) to authenticated;

-- Meldungsstatus setzen; die meldende Person erfaehrt das Ergebnis (ohne Details)
create or replace function public.treff_meldung_setzen(p_id uuid, p_status text, p_notiz text)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  m meldungen%rowtype;
begin
  if not team_darf('treff.meldungen_bearbeiten') then raise exception 'Dafür fehlt dir das Recht.' using errcode = '42501'; end if;
  if p_status not in ('offen', 'in_pruefung', 'erledigt', 'keine_massnahme') then raise exception 'Ungültiger Status.' using errcode = 'P0001'; end if;
  select * into m from meldungen where id = p_id and bereich = 'treff';
  if m.id is null then raise exception 'Meldung nicht gefunden.' using errcode = 'P0001'; end if;
  update meldungen set status = p_status, admin_notiz = nullif(left(btrim(coalesce(p_notiz, '')), 2000), ''),
    bearbeitet_von = auth.uid(), bearbeitet_am = now()
  where id = p_id;
  if m.melder_id is not null and m.status is distinct from p_status and p_status in ('erledigt', 'keine_massnahme') then
    insert into benachrichtigungen (user_id, typ, text, link)
    values (m.melder_id, 'meldung_status', 'Deine Meldung im TanzRaum Treff wurde geprüft: '
            || case when p_status = 'erledigt' then 'Wir haben Maßnahmen ergriffen.' else 'Es war keine Maßnahme nötig.' end || ' Danke für deinen Hinweis!',
            '/dashboard/treff');
  end if;
  perform protokollieren('treff_meldung_' || p_status, m.ziel_user_id, jsonb_build_object('meldung_id', p_id));
end;
$function$;
revoke all on function public.treff_meldung_setzen(uuid, text, text) from public, anon;
grant execute on function public.treff_meldung_setzen(uuid, text, text) to authenticated;

-- Treff-Sperre: Schreiben im Treff sperren (befristet/unbefristet). Nie den Admin; Teammitglieder nur durch den Admin.
create or replace function public.treff_nutzer_sperren(p_user_id uuid, p_bis timestamptz, p_grund text)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if not team_darf('treff.nutzer_sperren') then raise exception 'Dafür fehlt dir das Recht.' using errcode = '42501'; end if;
  if p_user_id = auth.uid() then raise exception 'Du kannst dich nicht selbst sperren.' using errcode = 'P0001'; end if;
  if exists (select 1 from profiles p where p.id = p_user_id and p.ist_plattform_admin) then
    raise exception 'Der TanzRaum-Admin kann nicht gesperrt werden.' using errcode = '42501';
  end if;
  if not ist_plattform_admin_aktuell() and exists (select 1 from team_mitglieder t where t.user_id = p_user_id) then
    raise exception 'Teammitglieder kann nur der TanzRaum-Admin sperren.' using errcode = '42501';
  end if;
  if p_bis is not null and p_bis <= now() then raise exception 'Das Ende der Sperre liegt in der Vergangenheit.' using errcode = 'P0001'; end if;
  insert into treff_sperren (user_id, bis, grund, gesperrt_von) values (p_user_id, p_bis, nullif(left(btrim(coalesce(p_grund, '')), 500), ''), auth.uid())
  on conflict (user_id) do update set bis = excluded.bis, grund = excluded.grund, gesperrt_von = excluded.gesperrt_von, erstellt_am = now();
  perform protokollieren('treff_nutzer_gesperrt', p_user_id, jsonb_build_object('bis', p_bis, 'grund', nullif(left(btrim(coalesce(p_grund, '')), 500), '')));
end;
$function$;
revoke all on function public.treff_nutzer_sperren(uuid, timestamptz, text) from public, anon;
grant execute on function public.treff_nutzer_sperren(uuid, timestamptz, text) to authenticated;

create or replace function public.treff_nutzer_entsperren(p_user_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if not team_darf('treff.nutzer_sperren') then raise exception 'Dafür fehlt dir das Recht.' using errcode = '42501'; end if;
  delete from treff_sperren where user_id = p_user_id;
  perform protokollieren('treff_nutzer_entsperrt', p_user_id, '{}'::jsonb);
end;
$function$;
revoke all on function public.treff_nutzer_entsperren(uuid) from public, anon;
grant execute on function public.treff_nutzer_entsperren(uuid) to authenticated;

-- Nutzer aus dem Treff entfernen: alle Themen und Beitraege ausblenden (weich geloescht) und Schreiben unbefristet sperren.
-- Das Konto selbst bleibt bestehen (Kontoloeschung nur ueber die bestehende Loeschlogik des TanzRaum-Admins).
create or replace function public.treff_nutzer_entfernen(p_user_id uuid, p_grund text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_themen int;
  v_beitraege int;
begin
  if not team_darf('treff.nutzer_entfernen') then raise exception 'Dafür fehlt dir das Recht.' using errcode = '42501'; end if;
  if p_user_id = auth.uid() then raise exception 'Das ist nicht möglich.' using errcode = 'P0001'; end if;
  if exists (select 1 from profiles p where p.id = p_user_id and p.ist_plattform_admin) then
    raise exception 'Der TanzRaum-Admin kann nicht entfernt werden.' using errcode = '42501';
  end if;
  if not ist_plattform_admin_aktuell() and exists (select 1 from team_mitglieder t where t.user_id = p_user_id) then
    raise exception 'Teammitglieder kann nur der TanzRaum-Admin entfernen.' using errcode = '42501';
  end if;
  update treff_themen set geloescht_am = now(), geloescht_von = auth.uid(), angepinnt = false
  where autor_id = p_user_id and geloescht_am is null;
  get diagnostics v_themen = row_count;
  with weg as (
    update treff_beitraege set geloescht_am = now(), geloescht_von = auth.uid()
    where autor_id = p_user_id and geloescht_am is null returning thema_id, id
  )
  update treff_themen t set antworten = greatest(0, t.antworten - x.anzahl),
    beste_antwort_id = case when t.beste_antwort_id = any(x.ids) then null else t.beste_antwort_id end
  from (select thema_id, count(*)::int as anzahl, array_agg(id) as ids from weg group by thema_id) x
  where t.id = x.thema_id;
  select count(*) into v_beitraege from treff_beitraege b where b.autor_id = p_user_id and b.geloescht_von = auth.uid() and b.geloescht_am > now() - interval '1 minute';
  delete from treff_abos where user_id = p_user_id;
  insert into treff_sperren (user_id, bis, grund, gesperrt_von) values (p_user_id, null, nullif(left(btrim(coalesce(p_grund, '')), 500), ''), auth.uid())
  on conflict (user_id) do update set bis = null, grund = excluded.grund, gesperrt_von = excluded.gesperrt_von, erstellt_am = now();
  perform protokollieren('treff_nutzer_entfernt', p_user_id, jsonb_build_object('themen', v_themen, 'beitraege', v_beitraege,
    'grund', nullif(left(btrim(coalesce(p_grund, '')), 500), '')));
  return jsonb_build_object('themen', v_themen, 'beitraege', v_beitraege);
end;
$function$;
revoke all on function public.treff_nutzer_entfernen(uuid, text) from public, anon;
grant execute on function public.treff_nutzer_entfernen(uuid, text) to authenticated;

-- Kategorien verwalten: nur TanzRaum-Admin
create or replace function public.treff_kategorie_speichern(p_id uuid, p_name text, p_emoji text, p_beschreibung text, p_aktiv boolean)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_id uuid;
begin
  if not ist_plattform_admin_aktuell() then raise exception 'Nur für die TanzRaum-Administration.' using errcode = '42501'; end if;
  if p_id is null then
    insert into treff_kategorien (name, emoji, beschreibung, aktiv, sortierung)
    values (btrim(p_name), nullif(btrim(coalesce(p_emoji, '')), ''), nullif(btrim(coalesce(p_beschreibung, '')), ''), coalesce(p_aktiv, true),
            coalesce((select max(sortierung) + 10 from treff_kategorien), 10))
    returning id into v_id;
  else
    update treff_kategorien set name = btrim(p_name), emoji = nullif(btrim(coalesce(p_emoji, '')), ''),
      beschreibung = nullif(btrim(coalesce(p_beschreibung, '')), ''), aktiv = coalesce(p_aktiv, true)
    where id = p_id returning id into v_id;
    if v_id is null then raise exception 'Kategorie nicht gefunden.' using errcode = 'P0001'; end if;
  end if;
  perform protokollieren('treff_kategorie_gespeichert', null, jsonb_build_object('kategorie_id', v_id, 'name', btrim(p_name), 'aktiv', coalesce(p_aktiv, true)));
  return v_id;
end;
$function$;
revoke all on function public.treff_kategorie_speichern(uuid, text, text, text, boolean) from public, anon;
grant execute on function public.treff_kategorie_speichern(uuid, text, text, text, boolean) to authenticated;

create or replace function public.treff_kategorien_sortieren(p_ids uuid[])
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if not ist_plattform_admin_aktuell() then raise exception 'Nur für die TanzRaum-Administration.' using errcode = '42501'; end if;
  update treff_kategorien k set sortierung = x.pos * 10
  from (select id, ordinality as pos from unnest(p_ids) with ordinality as u(id, ordinality)) x
  where k.id = x.id;
end;
$function$;
revoke all on function public.treff_kategorien_sortieren(uuid[]) from public, anon;
grant execute on function public.treff_kategorien_sortieren(uuid[]) to authenticated;

-- Loeschen nur, wenn keine Themen (auch keine ausgeblendeten) darin liegen – sonst deaktivieren
create or replace function public.treff_kategorie_loeschen(p_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_name text;
begin
  if not ist_plattform_admin_aktuell() then raise exception 'Nur für die TanzRaum-Administration.' using errcode = '42501'; end if;
  if exists (select 1 from treff_themen t where t.kategorie_id = p_id) then
    raise exception 'In dieser Kategorie gibt es Themen. Verschiebe sie zuerst oder deaktiviere die Kategorie.' using errcode = 'P0001';
  end if;
  if exists (select 1 from wissen_artikel w where w.kategorie_id = p_id) then
    raise exception 'Diese Kategorie wird in TanzRaum Wissen verwendet. Deaktiviere sie stattdessen.' using errcode = 'P0001';
  end if;
  delete from treff_kategorien where id = p_id returning name into v_name;
  perform protokollieren('treff_kategorie_geloescht', null, jsonb_build_object('kategorie_id', p_id, 'name', v_name));
end;
$function$;

-- Bilder und PDF im Treff: privater Bucket, lesen fuer alle Angemeldeten, hochladen nur in den eigenen Ordner
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('treff', 'treff', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update set public = false, file_size_limit = 10485760, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
drop policy if exists "Treff-Dateien lesen" on storage.objects;
create policy "Treff-Dateien lesen" on storage.objects for select to authenticated using (bucket_id = 'treff');
drop policy if exists "Treff-Dateien hochladen" on storage.objects;
create policy "Treff-Dateien hochladen" on storage.objects for insert to authenticated
  with check (bucket_id = 'treff' and (storage.foldername(name))[1] = auth.uid()::text
              and (public.treff_darf_schreiben(auth.uid()) or public.team_darf('treff.themen_erstellen')));
drop policy if exists "Treff-Dateien loeschen" on storage.objects;
create policy "Treff-Dateien loeschen" on storage.objects for delete to authenticated
  using (bucket_id = 'treff' and (storage.foldername(name))[1] = auth.uid()::text);

-- =============================================================================================
-- 3) TanzRaum Wissen
-- =============================================================================================
create table if not exists public.wissen_artikel (
  id uuid primary key default gen_random_uuid(),
  titel text not null check (char_length(btrim(titel)) between 5 and 160),
  kategorie_id uuid references public.treff_kategorien(id) on delete set null,
  einleitung text check (char_length(einleitung) <= 1000),
  inhalt text not null check (char_length(btrim(inhalt)) between 10 and 30000),
  bild_pfad text check (bild_pfad is null or bild_pfad ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$'),
  link text check (link is null or (link ~ '^https?://\S+$' and char_length(link) <= 500)),
  redaktionshinweis text check (char_length(redaktionshinweis) <= 500),
  treff_thema_id uuid references public.treff_themen(id) on delete set null,
  status text not null default 'entwurf' check (status in ('entwurf', 'veroeffentlicht')),
  erstellt_von uuid references public.profiles(id) on delete set null,
  erstellt_am timestamptz not null default now(),
  geaendert_am timestamptz not null default now(),
  veroeffentlicht_am timestamptz,
  suchtext tsvector generated always as (to_tsvector('german', coalesce(titel, '') || ' ' || coalesce(einleitung, '') || ' ' || coalesce(inhalt, ''))) stored
);
create index if not exists wissen_status on public.wissen_artikel (status, veroeffentlicht_am desc);
create index if not exists wissen_suche on public.wissen_artikel using gin (suchtext);
alter table public.wissen_artikel enable row level security;
drop policy if exists "Wissen lesen" on public.wissen_artikel;
create policy "Wissen lesen" on public.wissen_artikel for select to authenticated
  using (status = 'veroeffentlicht' or team_darf('wissen.erstellen') or team_darf('wissen.bearbeiten')
         or team_darf('wissen.veroeffentlichen') or team_darf('wissen.loeschen'));
revoke all on public.wissen_artikel from public, anon, authenticated;
grant select on public.wissen_artikel to authenticated;
grant all on public.wissen_artikel to service_role;

create or replace function public.wissen_speichern(p_id uuid, p jsonb)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_id uuid;
  v_kat uuid := nullif(p->>'kategorie_id', '')::uuid;
  v_thema uuid := nullif(p->>'treff_thema_id', '')::uuid;
  v_bild text := nullif(p->>'bild_pfad', '');
begin
  if p_id is null and not team_darf('wissen.erstellen') then raise exception 'Dafür fehlt dir das Recht „Wissen erstellen“.' using errcode = '42501'; end if;
  if p_id is not null and not team_darf('wissen.bearbeiten') then raise exception 'Dafür fehlt dir das Recht „Wissen bearbeiten“.' using errcode = '42501'; end if;
  if v_kat is not null and not exists (select 1 from treff_kategorien k where k.id = v_kat) then raise exception 'Kategorie nicht gefunden.' using errcode = 'P0001'; end if;
  if v_thema is not null and not exists (select 1 from treff_themen t where t.id = v_thema) then raise exception 'Treff-Thema nicht gefunden.' using errcode = 'P0001'; end if;
  if p_id is null then
    if v_bild is not null and split_part(v_bild, '/', 1) <> auth.uid()::text then raise exception 'Das Bild konnte nicht zugeordnet werden.' using errcode = 'P0001'; end if;
    insert into wissen_artikel (titel, kategorie_id, einleitung, inhalt, bild_pfad, link, redaktionshinweis, treff_thema_id, erstellt_von)
    values (btrim(p->>'titel'), v_kat, nullif(btrim(coalesce(p->>'einleitung', '')), ''), btrim(p->>'inhalt'), v_bild,
            nullif(btrim(coalesce(p->>'link', '')), ''), nullif(btrim(coalesce(p->>'redaktionshinweis', '')), ''), v_thema, auth.uid())
    returning id into v_id;
    perform protokollieren('wissen_erstellt', null, jsonb_build_object('artikel_id', v_id, 'titel', btrim(p->>'titel'), 'treff_thema_id', v_thema));
  else
    update wissen_artikel set titel = btrim(p->>'titel'), kategorie_id = v_kat, einleitung = nullif(btrim(coalesce(p->>'einleitung', '')), ''),
      inhalt = btrim(p->>'inhalt'), bild_pfad = v_bild, link = nullif(btrim(coalesce(p->>'link', '')), ''),
      redaktionshinweis = nullif(btrim(coalesce(p->>'redaktionshinweis', '')), ''), treff_thema_id = v_thema, geaendert_am = now()
    where id = p_id returning id into v_id;
    if v_id is null then raise exception 'Artikel nicht gefunden.' using errcode = 'P0001'; end if;
    perform protokollieren('wissen_bearbeitet', null, jsonb_build_object('artikel_id', v_id, 'titel', btrim(p->>'titel')));
  end if;
  return v_id;
end;
$function$;
revoke all on function public.wissen_speichern(uuid, jsonb) from public, anon;
grant execute on function public.wissen_speichern(uuid, jsonb) to authenticated;

create or replace function public.wissen_veroeffentlichen(p_id uuid, p_an boolean)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_titel text;
begin
  if not team_darf('wissen.veroeffentlichen') then raise exception 'Dafür fehlt dir das Recht „Wissen veröffentlichen“.' using errcode = '42501'; end if;
  update wissen_artikel set status = case when p_an then 'veroeffentlicht' else 'entwurf' end,
    veroeffentlicht_am = case when p_an then coalesce(veroeffentlicht_am, now()) else veroeffentlicht_am end, geaendert_am = now()
  where id = p_id returning titel into v_titel;
  if v_titel is null then raise exception 'Artikel nicht gefunden.' using errcode = 'P0001'; end if;
  perform protokollieren(case when p_an then 'wissen_veroeffentlicht' else 'wissen_zurueckgezogen' end, null,
    jsonb_build_object('artikel_id', p_id, 'titel', v_titel));
end;
$function$;
revoke all on function public.wissen_veroeffentlichen(uuid, boolean) from public, anon;
grant execute on function public.wissen_veroeffentlichen(uuid, boolean) to authenticated;

create or replace function public.wissen_loeschen(p_id uuid)
 returns text
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  w wissen_artikel%rowtype;
begin
  if not team_darf('wissen.loeschen') then raise exception 'Dafür fehlt dir das Recht „Wissen löschen“.' using errcode = '42501'; end if;
  delete from wissen_artikel where id = p_id returning * into w;
  if w.id is null then raise exception 'Artikel nicht gefunden.' using errcode = 'P0001'; end if;
  perform protokollieren('wissen_geloescht', null, jsonb_build_object('artikel_id', p_id, 'titel', w.titel));
  return w.bild_pfad;
end;
$function$;
revoke all on function public.wissen_loeschen(uuid) from public, anon;
grant execute on function public.wissen_loeschen(uuid) to authenticated;

-- Kategorie-Loeschfunktion braucht wissen_artikel (oben angelegt) – Rechte hier vergeben
revoke all on function public.treff_kategorie_loeschen(uuid) from public, anon;
grant execute on function public.treff_kategorie_loeschen(uuid) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('wissen', 'wissen', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];
drop policy if exists "Wissen-Bilder lesen" on storage.objects;
create policy "Wissen-Bilder lesen" on storage.objects for select to authenticated using (bucket_id = 'wissen');
drop policy if exists "Wissen-Bilder hochladen" on storage.objects;
create policy "Wissen-Bilder hochladen" on storage.objects for insert to authenticated
  with check (bucket_id = 'wissen' and (storage.foldername(name))[1] = auth.uid()::text
              and (public.team_darf('wissen.erstellen') or public.team_darf('wissen.bearbeiten')));

-- =============================================================================================
-- 4) Datenexport: eigene Treff-Inhalte, Workshops und Folgen gehoeren zum Konto (Konto loeschen: Inhalte bleiben ohne
--    Autor erhalten wie bei Chatnachrichten; autor_id/eingereicht_von werden auf NULL gesetzt)
-- =============================================================================================
do $mig$
declare
  d text := pg_get_functiondef('public.meine_daten_export()'::regprocedure);
  alt text := $o$('boerse_kontakte', 'interessent_id', array[]::text[])$o$;
  neu text := $n$('boerse_kontakte', 'interessent_id', array[]::text[]), ('workshops', 'eingereicht_von', array[]::text[]),
      ('treff_themen', 'autor_id', array['suchtext']::text[]), ('treff_beitraege', 'autor_id', array[]::text[]),
      ('treff_abos', 'user_id', array[]::text[]), ('treff_hilfreich', 'user_id', array[]::text[]),
      ('treff_sperren', 'user_id', array[]::text[]), ('team_mitglieder', 'user_id', array[]::text[])$n$;
begin
  if position(alt in d) = 0 then raise exception 'meine_daten_export: Ausdruck nicht gefunden'; end if;
  execute replace(d, alt, neu);
end
$mig$;
