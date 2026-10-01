-- Spotlight als eigener Bereich mit Story-Editor (frei positionierbare Ebenen) und persoenliche Navigation
--
-- Bestehende Spotlight-Architektur wird erweitert (Tabelle spotlights, Bucket spotlights, Sichtbarkeit darf_spotlight_sehen,
-- 24 Stunden, Aufraeumen, Melden). Bestehende Regeln bleiben: persoenlich (kein Posten als Verein), Erstellen ab BASIC,
-- unter 16 nur Verein & Kontakte (solange die Eltern nichts anderes festlegen), Blockieren hat Vorrang.
--
--   ebenen   : Text, Sticker/TanzRaum-Smileys, Emojis, Standort, Erwaehnungen, Zeichnung – Position/Groesse/Drehung relativ
--   musik    : Ausschnitt aus der bestehenden TanzRaum-Musik (musik_titel) – nur bei eingeschaltetem Musikbereich
--   hashtags : aus den Texten
--   story_id : mehrere Seiten einer Story
-- Persoenliche Navigation: nur die Reihenfolge (profiles.navigation_reihenfolge) – sie vergibt nie Rechte.

-- ---------------------------------------------------------------------------------------------
-- 1) Spotlight: neue Spalten, Video im Bucket
-- ---------------------------------------------------------------------------------------------
alter table public.spotlights
  add column if not exists ebenen jsonb not null default '[]'::jsonb,
  add column if not exists musik jsonb,
  add column if not exists hashtags text[] not null default '{}',
  add column if not exists story_id uuid;
create index if not exists spotlights_story_idx on public.spotlights (story_id) where story_id is not null;
create index if not exists spotlights_hashtags_idx on public.spotlights using gin (hashtags);

-- Videos (im Browser verkleinert, wie im Messenger) – Grenze wie chat-dateien
update storage.buckets
set file_size_limit = 26214400,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime']
where id = 'spotlights';

-- Ebenen pruefen und bereinigen (nur bekannte Felder, Grenzen fuer Position/Groesse/Drehung)
create or replace function public.spotlight_ebenen_bereinigen(p_ebenen jsonb)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  e jsonb;
  aus jsonb := '[]'::jsonb;
  typ text;
  basis jsonb;
  uid uuid;
  n int := 0;
begin
  if p_ebenen is null or jsonb_typeof(p_ebenen) <> 'array' then return '[]'::jsonb; end if;
  if octet_length(p_ebenen::text) > 120000 then
    raise exception 'Die Story enthält zu viele Elemente.' using errcode = 'P0001';
  end if;
  for e in select * from jsonb_array_elements(p_ebenen) loop
    n := n + 1;
    exit when n > 40;
    typ := e->>'typ';
    if typ not in ('text', 'sticker', 'emoji', 'standort', 'erwaehnung', 'zeichnung') then continue; end if;
    basis := jsonb_build_object(
      'id', left(coalesce(e->>'id', gen_random_uuid()::text), 40),
      'typ', typ,
      'x', least(greatest(coalesce((e->>'x')::numeric, 0.5), -0.2), 1.2),
      'y', least(greatest(coalesce((e->>'y')::numeric, 0.5), -0.2), 1.2),
      'skala', least(greatest(coalesce((e->>'skala')::numeric, 1), 0.2), 6),
      'drehung', least(greatest(coalesce((e->>'drehung')::numeric, 0), -720), 720));
    if typ = 'text' then
      if nullif(btrim(coalesce(e->>'text', '')), '') is null then continue; end if;
      aus := aus || (basis || jsonb_build_object(
        'text', left(e->>'text', 300),
        'stil', case when e->>'stil' in ('klassisch', 'kraeftig', 'schrift', 'neon', 'schreibmaschine') then e->>'stil' else 'klassisch' end,
        'farbe', case when coalesce(e->>'farbe', '') ~ '^#[0-9a-fA-F]{6}$' then e->>'farbe' else '#ffffff' end,
        'hinterlegt', coalesce((e->>'hinterlegt')::boolean, false),
        'ausrichtung', case when e->>'ausrichtung' in ('links', 'mitte', 'rechts') then e->>'ausrichtung' else 'mitte' end));
    elsif typ = 'sticker' then
      if coalesce(e->>'sticker', '') !~ '^[a-z]\d{2,3}$' or not exists (select 1 from sticker s where s.id = e->>'sticker') then continue; end if;
      aus := aus || (basis || jsonb_build_object('sticker', e->>'sticker'));
    elsif typ = 'emoji' then
      if char_length(coalesce(e->>'emoji', '')) not between 1 and 8 then continue; end if;
      aus := aus || (basis || jsonb_build_object('emoji', e->>'emoji'));
    elsif typ = 'standort' then
      -- nur der bewusst gewaehlte Ortsname, keine Koordinaten
      if nullif(btrim(coalesce(e->>'ort', '')), '') is null then continue; end if;
      aus := aus || (basis || jsonb_build_object('ort', left(btrim(e->>'ort'), 80)));
    elsif typ = 'erwaehnung' then
      begin uid := (e->>'user_id')::uuid; exception when others then continue; end;
      -- Erwaehnen nur, wen ich auch kontaktieren darf (Jugendschutz, Blockieren, Elternsperre gelten weiter)
      if uid is null or uid = auth.uid() or not darf_direkt_schreiben(uid) then continue; end if;
      aus := aus || (basis || jsonb_build_object('user_id', uid,
        'name', '@' || ltrim(coalesce((select a.anzeige from anzeige_namen(array[uid]) a), 'TanzRaum'), '@')));
    elsif typ = 'zeichnung' then
      if jsonb_typeof(e->'striche') <> 'array' or jsonb_array_length(e->'striche') = 0 then continue; end if;
      aus := aus || (basis || jsonb_build_object('striche', (
        select coalesce(jsonb_agg(jsonb_build_object(
                 'farbe', case when coalesce(s->>'farbe', '') ~ '^#[0-9a-fA-F]{6}$' then s->>'farbe' else '#ffffff' end,
                 'breite', least(greatest(coalesce((s->>'breite')::numeric, 0.01), 0.002), 0.08),
                 'punkte', (select coalesce(jsonb_agg(jsonb_build_array(round(least(greatest((p->>0)::numeric, 0), 1), 4),
                                                                      round(least(greatest((p->>1)::numeric, 0), 1), 4))), '[]'::jsonb)
                            from (select p from jsonb_array_elements(coalesce(s->'punkte', '[]'::jsonb)) p limit 800) q))), '[]'::jsonb)
        from (select s from jsonb_array_elements(e->'striche') s limit 80) t)));
    end if;
  end loop;
  return aus;
end;
$$;
revoke all on function public.spotlight_ebenen_bereinigen(jsonb) from public, anon, authenticated;

-- Spotlight veroeffentlichen (neue Fassung mit Ebenen, Musik, Seiten). spotlight_erstellen bleibt fuer aeltere App-Versionen.
create or replace function public.spotlight_veroeffentlichen(
  p_media_path text, p_media_typ text, p_hintergrund text, p_sichtbarkeit text,
  p_ebenen jsonb, p_musik jsonb, p_story_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_ebenen jsonb;
  v_musik jsonb;
  v_titel musik_titel%rowtype;
  v_hashtags text[];
  v_text text;
  v_name text;
  e jsonb;
  m uuid;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet.' using errcode = '42501'; end if;
  if not spotlights_fuer_mich() then
    raise exception 'Spotlights sind derzeit nicht verfügbar.' using errcode = 'P0001';
  end if;
  if not konto_aktiv() then raise exception 'Dein Konto ist gesperrt.' using errcode = '42501'; end if;
  if tarif_von(auth.uid()) not in ('basic', 'verein') then
    raise exception 'Spotlights erstellen gibt es ab BASIC oder über einen Verein mit Vereinslizenz. Ansehen kannst du sie auch mit FREE.' using errcode = 'P0001';
  end if;
  if p_media_typ not in ('foto', 'video', 'text') or p_sichtbarkeit not in ('netzwerk', 'kontakte') then
    raise exception 'Ungültiges Spotlight.' using errcode = 'P0001';
  end if;
  -- Unter 16: oeffentliche Sichtbarkeit serverseitig ausgeschlossen, solange die Eltern sie nicht erlaubt haben (unveraendert)
  if ist_unter_16(auth.uid())
     and (not hat_eltern(auth.uid())
          or coalesce((select ke.spotlights_nur_kontakte from kind_einstellungen ke where ke.kind_id = auth.uid()), true)) then
    p_sichtbarkeit := 'kontakte';
  end if;
  v_ebenen := spotlight_ebenen_bereinigen(p_ebenen);
  if p_media_typ = 'text' then
    if jsonb_array_length(v_ebenen) = 0 then
      raise exception 'Schreib etwas oder füge ein Element hinzu.' using errcode = 'P0001';
    end if;
    p_media_path := null;
  elsif coalesce(p_media_path, '') not like auth.uid()::text || '/%'
     or not exists (select 1 from storage.objects o where o.bucket_id = 'spotlights' and o.name = p_media_path) then
    raise exception 'Die Datei wurde nicht gefunden. Bitte lade sie erneut hoch.' using errcode = 'P0001';
  end if;
  if p_hintergrund is not null and p_hintergrund not in ('rot', 'gold', 'navy', 'lila', 'gruen', 'rosa') then p_hintergrund := 'rot'; end if;
  if (select count(*) from spotlights s where s.user_id = auth.uid() and s.erstellt_am > now() - interval '1 day') >= 30 then
    raise exception 'Du hast heute schon 30 Spotlights geteilt – morgen geht es weiter.' using errcode = 'P0001';
  end if;
  -- Seiten einer Story gehoeren derselben Person
  if p_story_id is not null and exists (select 1 from spotlights s where s.story_id = p_story_id and s.user_id <> auth.uid()) then
    p_story_id := null;
  end if;

  -- Musik: nur aus der bestehenden TanzRaum-Musik, nur bei eingeschaltetem Musikbereich und nur, was ich selbst hoeren darf
  if p_musik is not null and jsonb_typeof(p_musik) = 'object' and p_musik ? 'titel_id' then
    if not musik_freigegeben() then
      raise exception 'Der Musikbereich ist derzeit ausgeschaltet.' using errcode = 'P0001';
    end if;
    select * into v_titel from musik_titel t where t.id = (p_musik->>'titel_id')::uuid and t.hochgeladen;
    if v_titel.id is null or not musik_datei_sichtbar(v_titel.datei_pfad) then
      raise exception 'Dieser Musiktitel ist nicht verfügbar.' using errcode = 'P0001';
    end if;
    v_musik := jsonb_build_object(
      'titel_id', v_titel.id, 'pfad', v_titel.datei_pfad, 'titel', v_titel.titel, 'interpret', v_titel.interpret,
      'start', least(greatest(coalesce((p_musik->>'start')::numeric, 0), 0), 3600),
      'dauer', least(greatest(coalesce((p_musik->>'dauer')::numeric, 15), 3), 30),
      'lautstaerke', least(greatest(coalesce((p_musik->>'lautstaerke')::numeric, 0.8), 0), 1));
  end if;

  -- Hashtags und Text (fuer Moderation/Meldungen) aus den Text-Ebenen
  select string_agg(x->>'text', ' ') into v_text from jsonb_array_elements(v_ebenen) x where x->>'typ' = 'text';
  select coalesce(array_agg(distinct lower(h[1])), '{}') into v_hashtags
  from regexp_matches(coalesce(v_text, ''), '#([[:alnum:]_äöüÄÖÜß]{2,40})', 'g') h;
  v_hashtags := v_hashtags[1:20];

  insert into spotlights (user_id, media_path, media_typ, text_overlay, hintergrund, sichtbarkeit, erstellt_am, ablauf_am,
                          ebenen, musik, hashtags, story_id)
  values (auth.uid(), p_media_path, p_media_typ, left(v_text, 500), coalesce(p_hintergrund, 'rot'), p_sichtbarkeit, now(), now() + interval '24 hours',
          v_ebenen, v_musik, v_hashtags, p_story_id)
  returning id into v_id;

  -- Erwaehnte Personen benachrichtigen (nur, wenn sie das Spotlight auch sehen koennen)
  v_name := coalesce((select a.anzeige from anzeige_namen(array[auth.uid()]) a), 'Jemand');
  for m in
    select distinct (x->>'user_id')::uuid from jsonb_array_elements(v_ebenen) x where x->>'typ' = 'erwaehnung' limit 10
  loop
    if p_sichtbarkeit = 'netzwerk' or hat_vereinsbeziehung(auth.uid(), m) or kontakt_angenommen(auth.uid(), m)
       or ist_elternteil_von(auth.uid(), m) or ist_elternteil_von(m, auth.uid()) then
      insert into benachrichtigungen (user_id, typ, text)
      values (m, 'spotlight_erwaehnung', v_name || ' hat dich in einem Spotlight erwähnt.');
    end if;
  end loop;
  return v_id;
end;
$$;
revoke all on function public.spotlight_veroeffentlichen(text, text, text, text, jsonb, jsonb, uuid) from public, anon;
grant execute on function public.spotlight_veroeffentlichen(text, text, text, text, jsonb, jsonb, uuid) to authenticated;

-- Story-Daten fuer die Ansicht (zusaetzlich Ebenen, Musik, Seite)
drop function public.spotlights_von(uuid);
create function public.spotlights_von(p_user_id uuid)
 returns table(id uuid, media_path text, media_typ text, text text, hintergrund text, sticker text, sichtbarkeit text,
               erstellt_am timestamp with time zone, ablauf_am timestamp with time zone, gesehen boolean, meine_reaktion text,
               ansichten integer, reaktionen jsonb, ebenen jsonb, musik jsonb, story_id uuid)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select s.id, s.media_path, s.media_typ, s.text_overlay, s.hintergrund, s.sticker, s.sichtbarkeit, s.erstellt_am, s.ablauf_am,
    exists (select 1 from spotlight_views v where v.spotlight_id = s.id and v.viewer_user_id = auth.uid()),
    (select r.emoji from spotlight_reactions r where r.spotlight_id = s.id and r.user_id = auth.uid()),
    case when s.user_id = auth.uid() then (select count(*)::int from spotlight_views v where v.spotlight_id = s.id and v.viewer_user_id <> auth.uid()) end,
    case when s.user_id = auth.uid() then (
      select coalesce(jsonb_agg(jsonb_build_object('name', a.anzeige, 'sticker', r.emoji) order by r.erstellt_am desc), '[]'::jsonb)
      from spotlight_reactions r join anzeige_namen(array(select r2.user_id from spotlight_reactions r2 where r2.spotlight_id = s.id)) a on a.user_id = r.user_id
      where r.spotlight_id = s.id) end,
    s.ebenen,
    case when s.musik is not null and musik_freigegeben() then s.musik - 'titel_id' end,
    s.story_id
  from spotlights s
  where s.user_id = p_user_id and s.ablauf_am > now() and s.entfernt_am is null and darf_spotlight_sehen(s.id)
  order by s.erstellt_am;
$function$;
revoke all on function public.spotlights_von(uuid) from public, anon;
grant execute on function public.spotlights_von(uuid) to authenticated;

-- Musik eines sichtbaren Spotlights darf abgespielt werden (nur bei eingeschaltetem Musikbereich)
create or replace function public.spotlight_musik_sichtbar(p_pfad text)
returns boolean language sql stable security definer set search_path = public as $$
  select musik_freigegeben() and exists (
    select 1 from spotlights s where s.musik->>'pfad' = p_pfad and s.ablauf_am > now() and darf_spotlight_sehen(s.id));
$$;
revoke all on function public.spotlight_musik_sichtbar(text) from public, anon;
grant execute on function public.spotlight_musik_sichtbar(text) to authenticated;

drop policy if exists "Musik lesen: hoerberechtigt" on storage.objects;
create policy "Musik lesen: hoerberechtigt" on storage.objects for select to authenticated
  using (bucket_id = 'musik' and (musik_datei_sichtbar(name) or spotlight_musik_sichtbar(name)));

-- Musiktitel, die ich in einer Story verwenden kann (eigene und die meines Vereins, die ich hoeren darf)
create or replace function public.spotlight_musik_auswahl()
returns table(id uuid, titel text, interpret text, art text)
language sql stable security definer set search_path = public as $$
  select t.id, t.titel, t.interpret, t.art
  from musik_titel t
  where musik_freigegeben() and t.hochgeladen and tarif_von(auth.uid()) in ('basic', 'verein') and musik_datei_sichtbar(t.datei_pfad)
  order by t.titel
  limit 200;
$$;
revoke all on function public.spotlight_musik_auswahl() from public, anon;
grant execute on function public.spotlight_musik_auswahl() to authenticated;

-- ---------------------------------------------------------------------------------------------
-- 2) Persoenliche Navigation (nur Reihenfolge)
-- ---------------------------------------------------------------------------------------------
alter table public.profiles add column if not exists navigation_reihenfolge text[];

create or replace function public.meine_navigation()
returns text[] language sql stable security definer set search_path = public as $$
  select p.navigation_reihenfolge from profiles p where p.id = auth.uid();
$$;
revoke all on function public.meine_navigation() from public, anon;
grant execute on function public.meine_navigation() to authenticated;

-- Gespeichert werden nur Menue-Kennungen (Pfade). Was jemand sehen und oeffnen darf, entscheidet weiterhin allein die
-- bestehende Berechtigungslogik – unbekannte oder nicht freigegebene Eintraege werden beim Anzeigen ignoriert.
create or replace function public.navigation_speichern(p_reihenfolge text[])
returns void language plpgsql security definer set search_path = public as $$
declare
  v text[];
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet.' using errcode = '42501'; end if;
  if p_reihenfolge is null or cardinality(p_reihenfolge) = 0 then
    update profiles set navigation_reihenfolge = null where id = auth.uid();
    return;
  end if;
  if cardinality(p_reihenfolge) > 100 then
    raise exception 'Zu viele Einträge.' using errcode = 'P0001';
  end if;
  select array_agg(x order by o) into v
  from (select distinct on (x) x, o from unnest(p_reihenfolge) with ordinality u(x, o)
        where x ~ '^/[a-z0-9/#_-]{1,80}$' order by x, o) q;
  update profiles set navigation_reihenfolge = v where id = auth.uid();
end;
$$;
revoke all on function public.navigation_speichern(text[]) from public, anon;
grant execute on function public.navigation_speichern(text[]) to authenticated;
