-- Zentrale Speicherkontingente (TanzRaum-Admin)
--
-- Bisher fest im Code: TeamCloud 500 MB je Verein / 100 MB persoenlich (teamcloud_limit),
-- Musik 1 GB je Verein / 200 MB persoenlich (musik_limit). Alle anderen Upload-Bereiche hatten nur Groessengrenzen je Datei.
--
-- Jetzt:
--   1) TECHNISCH verfuegbarer Speicher (plattform_einstellungen.speicher_technisch_mb, nur Information, z. B. Supabase-Tarif)
--      und der fuer TanzRaum FREIGEGEBENE Gesamtspeicher (speicher_gesamt_mb) sind getrennt.
--   2) TANZRAUM-KONTINGENTE je Bereich in speicher_kontingente (Einheit ueberall: MB = 1024 * 1024 Byte).
--      Weitere Bereiche = weitere Zeile (bezug person/verein, Buckets, Pruefart) – keine Code-Aenderung an den Grenzen noetig.
--   3) Pruefung serverseitig:
--      - pruefung 'reservierung' (TeamCloud, Musik): exakt vor dem Upload (…_upload_vorbereiten, Groesse bekannt) und beim Abschliessen
--      - pruefung 'storage' (Chat, Spotlights, Community, Vereinsdaten): in einer zusaetzlichen RESTRICTIVE-Regel auf storage.objects –
--        neue Dateien nur, solange der Bereich unter dem Kontingent liegt (die Groesse der neuen Datei kennt die Datenbank vorher nicht,
--        daher hoechstens eine Datei ueber dem Limit; Groesse je Datei begrenzt der Bucket). Genaue Vorpruefung: speicher_vorpruefung.
--      - Gesamtspeicher voll -> keine neuen Uploads (alle Buckets).
--   Reduzieren loescht nie Dateien – wer darueber liegt, kann erst nach dem Entfernen von Dateien wieder hochladen.
-- Bestehende Regeln, Buckets, Dateien und Daten werden nicht veraendert.

-- 1) Gesamt- und technischer Speicher (bestehende Einstellungstabelle, nur fuer die Administration ueber Funktionen lesbar)
alter table public.plattform_einstellungen add column if not exists speicher_gesamt_mb integer not null default 1000;
alter table public.plattform_einstellungen add column if not exists speicher_technisch_mb integer default 1024;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'plattform_speicher_gesamt_check') then
    alter table public.plattform_einstellungen add constraint plattform_speicher_gesamt_check check (speicher_gesamt_mb between 1 and 1000000000);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'plattform_speicher_technisch_check') then
    alter table public.plattform_einstellungen add constraint plattform_speicher_technisch_check check (speicher_technisch_mb is null or speicher_technisch_mb between 1 and 1000000000);
  end if;
end $$;
comment on column public.plattform_einstellungen.speicher_gesamt_mb is 'Fuer TanzRaum freigegebener Gesamtspeicher in MB (nicht automatisch der technische Speicher)';
comment on column public.plattform_einstellungen.speicher_technisch_mb is 'Technisch verfuegbarer Speicher in MB laut Anbieter (nur Information/Warnung)';

-- 2) Kontingente je Speicherbereich
create table if not exists public.speicher_kontingente (
  schluessel text primary key check (schluessel ~ '^[a-z][a-z0-9_]{1,40}$'),
  bezeichnung text not null check (char_length(bezeichnung) between 1 and 80),
  beschreibung text check (beschreibung is null or char_length(beschreibung) <= 300),
  bezug text not null check (bezug in ('person', 'verein')),
  pruefung text not null check (pruefung in ('reservierung', 'storage')),
  buckets text[] not null default '{}',
  limit_mb integer not null check (limit_mb between 0 and 1000000000),
  aktiv boolean not null default true,
  reihenfolge integer not null default 100,
  geaendert_am timestamptz not null default now(),
  geaendert_von uuid references public.profiles(id) on delete set null
);
comment on table public.speicher_kontingente is 'Speicherkontingente je Bereich (MB) – zentral, nur ueber Admin-Funktionen aenderbar';
alter table public.speicher_kontingente enable row level security;
revoke all on public.speicher_kontingente from public, anon, authenticated;
grant all on public.speicher_kontingente to service_role;

-- Startwerte = bisherige feste Werte; neue Bereiche grosszuegig, damit nichts Bestehendes blockiert
insert into public.speicher_kontingente (schluessel, bezeichnung, beschreibung, bezug, pruefung, buckets, limit_mb, reihenfolge) values
  ('teamcloud_verein', 'TeamCloud – Verein (VEREIN)', 'Dateien der Vereins-TeamCloud, je Verein', 'verein', 'reservierung', '{vereins-dateien}', 500, 10),
  ('teamcloud_persoenlich', 'TeamCloud – persönlich (BASIC)', 'Eigene Dateien je Person ab BASIC', 'person', 'reservierung', '{vereins-dateien}', 100, 20),
  ('musik_verein', 'Musik – Verein', 'Vereinsmusik je Verein', 'verein', 'reservierung', '{musik}', 1024, 30),
  ('musik_persoenlich', 'Musik – persönlich (BASIC)', 'Eigene Musik je Person ab BASIC', 'person', 'reservierung', '{musik}', 200, 40),
  ('chat', 'Chat-Bilder & -Dateien', 'Bilder, Dokumente, Sprach- und Videonachrichten je Person', 'person', 'storage', '{chat-bilder,chat-dateien}', 500, 50),
  ('spotlights', 'Spotlights', 'Fotos und Videos der Spotlights je Person', 'person', 'storage', '{spotlights}', 500, 60),
  ('community', 'Börse, Treff, Workshops & Wissen', 'Bilder und Dateien in Community-Bereichen je Person', 'person', 'storage', '{boerse,treff,workshops,wissen}', 200, 70),
  ('vereinsdaten', 'Weitere Vereinsdaten', 'Kostümfotos, Belege, Ehrungs- und Antragsdokumente, Logo, Satzung – je Verein', 'verein', 'storage',
   '{kostueme,kassenbuch-belege,ehrungs-dokumente,mitgliedsantraege,verein-logos,vereinsdokumente}', 1024, 80)
on conflict (schluessel) do nothing;

-- 3) Hilfsfunktionen
-- Lesbare Groesse (deutsch): 980 KB, 98 MB, 1,2 GB
create or replace function public.speicher_groesse_text(p_bytes bigint)
returns text language sql immutable set search_path = public as $$
  select case
    when coalesce(p_bytes, 0) <= 0 then '0 MB'
    when coalesce(p_bytes, 0) >= 1073741824 then regexp_replace(replace(to_char(p_bytes / 1073741824.0, 'FM999999990.0'), '.', ','), ',0$', '') || ' GB'
    when coalesce(p_bytes, 0) >= 1048576 then regexp_replace(replace(to_char(p_bytes / 1048576.0, 'FM999999990.0'), '.', ','), ',0$', '') || ' MB'
    else greatest(1, round(coalesce(p_bytes, 0) / 1024.0))::bigint || ' KB' end;
$$;

create or replace function public.speicher_limit_bytes(p_schluessel text)
returns bigint language sql stable security definer set search_path = public as $$
  select limit_mb::bigint * 1048576 from speicher_kontingente where schluessel = p_schluessel;
$$;

-- Belegter TanzRaum-Speicher (alle Dateien in allen Buckets)
create or replace function public.speicher_gesamt_belegt()
returns bigint language sql stable security definer set search_path = public, storage as $$
  select coalesce(sum((o.metadata ->> 'size')::bigint), 0)::bigint from storage.objects o;
$$;

-- Passt eine neue Datei (p_neu Byte; 0 = Groesse unbekannt) noch in den freigegebenen Gesamtspeicher?
create or replace function public.speicher_gesamt_frei(p_neu bigint default 0)
returns boolean language sql stable security definer set search_path = public as $$
  select speicher_gesamt_belegt() + greatest(coalesce(p_neu, 0), 1)
         <= coalesce((select speicher_gesamt_mb from plattform_einstellungen where id), 1000)::bigint * 1048576;
$$;

-- Verein aus dem Dateipfad (Vereins-Buckets: "<verein_id>/…"; TeamCloud/Musik: "verein/<verein_id>/…")
create or replace function public.speicher_pfad_verein(p_name text)
returns uuid language sql immutable set search_path = public as $$
  select case
    when split_part(p_name, '/', 1) = 'verein' and split_part(p_name, '/', 2) ~* '^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$' then split_part(p_name, '/', 2)::uuid
    when split_part(p_name, '/', 1) ~* '^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$' then split_part(p_name, '/', 1)::uuid
  end;
$$;

-- Speicherbereich einer Datei (TeamCloud/Musik: "verein/…" = Vereinsbereich, sonst persoenlich)
create or replace function public.speicher_kategorie(p_bucket text, p_name text)
returns text language sql stable security definer set search_path = public as $$
  select k.schluessel from speicher_kontingente k
  where p_bucket = any(k.buckets)
    and (k.pruefung = 'storage' or (k.bezug = 'verein') = (split_part(p_name, '/', 1) = 'verein'))
  order by k.reihenfolge limit 1;
$$;

-- Belegung eines 'storage'-Bereichs: persoenlich = eigene hochgeladene Dateien, Verein = Dateien unter der Vereins-ID
create or replace function public.speicher_bereich_belegt(p_schluessel text, p_user uuid, p_verein uuid)
returns bigint language sql stable security definer set search_path = public, storage as $$
  select coalesce(sum((o.metadata ->> 'size')::bigint), 0)::bigint
  from speicher_kontingente k join storage.objects o on o.bucket_id = any(k.buckets)
  where k.schluessel = p_schluessel
    and case when k.bezug = 'verein' then p_verein is not null and split_part(o.name, '/', 1) = p_verein::text
             else p_user is not null and o.owner_id = p_user::text end;
$$;

-- Zentrale Pruefung vor einem Upload mit bekannter Groesse (Reservierung/Vorpruefung) – meldet verstaendlich
create or replace function public.speicher_pruefen(p_schluessel text, p_belegt bigint, p_neu bigint, p_verein boolean)
returns void language plpgsql stable security definer set search_path = public as $$
declare
  k speicher_kontingente%rowtype;
  v_limit bigint;
begin
  select * into k from speicher_kontingente where schluessel = p_schluessel;
  if found and not k.aktiv then
    raise exception 'Dieser Speicherbereich ist derzeit deaktiviert. Bestehende Dateien bleiben erhalten.' using errcode = 'P0001';
  end if;
  if not speicher_gesamt_frei(p_neu) then
    raise exception 'Der TanzRaum-Speicher ist derzeit voll. Neue Uploads sind vorübergehend nicht möglich – bestehende Dateien bleiben erhalten.' using errcode = 'P0001';
  end if;
  if found then
    v_limit := k.limit_mb::bigint * 1048576;
    if coalesce(p_belegt, 0) + coalesce(p_neu, 0) > v_limit then
      raise exception 'Speicherlimit erreicht. % % von %. Für diese Datei werden % benötigt.',
        case when p_verein then 'Der Verein verwendet' else 'Du verwendest' end,
        speicher_groesse_text(p_belegt), speicher_groesse_text(v_limit), speicher_groesse_text(p_neu) using errcode = 'P0001';
    end if;
  end if;
end;
$$;

-- 4) Bisherige feste Grenzen -> zentrale Kontingente (Fallback = alte Werte, falls ein Eintrag fehlt)
create or replace function public.teamcloud_limit(p_verein_id uuid)
 returns bigint
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select coalesce(speicher_limit_bytes(case when p_verein_id is not null then 'teamcloud_verein' else 'teamcloud_persoenlich' end),
                  case when p_verein_id is not null then 500::bigint * 1024 * 1024 else 100::bigint * 1024 * 1024 end);
$function$;

create or replace function public.musik_limit(p_verein_id uuid)
returns bigint language sql stable security definer set search_path = public as $$
  select coalesce(speicher_limit_bytes(case when p_verein_id is null then 'musik_persoenlich' else 'musik_verein' end),
                  case when p_verein_id is null then 209715200::bigint else 1073741824::bigint end);
$$;

-- TeamCloud/Musik: Reservierung prueft jetzt zentral. Zusaetzlich behoben: Upload ohne Ordner schrieb NULL in die
-- Pflichtspalte dateien.ordner_pfad (Hauptordner = '' wie der Spaltenstandard) – sonst unveraendert.
create or replace function public.teamcloud_upload_vorbereiten(p_verein_id uuid, p_name text, p_groesse bigint, p_mime text, p_ordner text default '')
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_name text := left(regexp_replace(btrim(coalesce(p_name, '')), '[\\/[:cntrl:]]', '_', 'g'), 120);
  v_sicher text;
  v_ordner text := left(regexp_replace(btrim(coalesce(p_ordner, '')), '[\\[:cntrl:]]|\.\.', '', 'g'), 120);
  v_id uuid := gen_random_uuid();
  v_pfad text;
  v_limit bigint := teamcloud_limit(p_verein_id);
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet.' using errcode = '42501';
  end if;
  if p_verein_id is not null then
    if not darf_teamcloud(p_verein_id) then
      raise exception 'In die TeamCloud des Vereins laden Vereinsadmin und Trainer hoch.' using errcode = '42501';
    end if;
  elsif not darf_eigene_dateien() then
    raise exception 'Eigene Dateien gibt es ab BASIC.' using errcode = '42501';
  end if;
  if v_name = '' then
    raise exception 'Bitte einen Dateinamen angeben.' using errcode = 'P0001';
  end if;
  if p_groesse is null or p_groesse <= 0 then
    raise exception 'Die Datei ist leer.' using errcode = 'P0001';
  end if;
  if p_groesse > 52428800 then
    raise exception 'Eine Datei darf höchstens 50 MB groß sein.' using errcode = 'P0001';
  end if;

  -- Abgebrochene Uploads (aelter als 1 Stunde) geben ihren Platz frei
  delete from dateien d where not d.hochgeladen and d.hochgeladen_am < now() - interval '1 hour'
    and (case when p_verein_id is not null then d.verein_id = p_verein_id else d.user_id = auth.uid() and d.verein_id is null end);

  -- Zentrale Pruefung: Bereich aktiv, TanzRaum-Gesamtspeicher, Kontingent aus speicher_kontingente
  perform speicher_pruefen(case when p_verein_id is not null then 'teamcloud_verein' else 'teamcloud_persoenlich' end,
                           teamcloud_belegt(p_verein_id, auth.uid()), p_groesse, p_verein_id is not null);

  v_sicher := coalesce(nullif(left(regexp_replace(v_name, '[^A-Za-z0-9._-]+', '-', 'g'), 80), ''), 'datei');
  v_pfad := case when p_verein_id is not null then 'verein/' || p_verein_id else 'user/' || auth.uid() end || '/' || v_id || '/' || v_sicher;

  insert into dateien (id, verein_id, user_id, ordner_pfad, name, storage_path, groesse_bytes, mime_type, ist_medien, hochgeladen_von, hochgeladen_am, hochgeladen)
  values (v_id, p_verein_id, case when p_verein_id is null then auth.uid() end, v_ordner, v_name, v_pfad, p_groesse,
          left(coalesce(p_mime, ''), 120), coalesce(p_mime, '') ~* '^(audio|video|image)/', auth.uid(), now(), false);
  return jsonb_build_object('id', v_id, 'pfad', v_pfad);
end;
$function$;

create or replace function public.musik_upload_vorbereiten(p_verein_id uuid, p_titel text, p_name text, p_groesse bigint, p_mime text,
  p_interpret text default null, p_art text default 'training', p_gruppen uuid[] default '{}')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_id uuid := gen_random_uuid();
  v_endung text := lower(coalesce(substring(coalesce(p_name, '') from '\.([A-Za-z0-9]{1,5})$'), 'mp3'));
  v_pfad text;
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet.' using errcode = '42501';
  end if;
  if p_verein_id is not null then
    if not darf_musik_verwalten(p_verein_id) then
      raise exception 'Vereinsmusik laden Vereinsadmin und Trainer hoch.' using errcode = '42501';
    end if;
  elsif not darf_eigene_dateien() then
    raise exception 'Eigene Musik gibt es ab BASIC.' using errcode = '42501';
  end if;
  if coalesce(p_mime, '') !~* '^audio/' then
    raise exception 'Bitte eine Audiodatei wählen (z. B. MP3, M4A, WAV).' using errcode = 'P0001';
  end if;
  if p_groesse is null or p_groesse <= 0 then
    raise exception 'Die Datei ist leer.' using errcode = 'P0001';
  end if;
  if p_groesse > 31457280 then
    raise exception 'Eine Musikdatei darf höchstens 30 MB groß sein.' using errcode = 'P0001';
  end if;
  -- Abgebrochene Uploads (aelter als 1 Stunde) geben ihren Platz frei
  delete from musik_titel m where not m.hochgeladen and m.erstellt_am < now() - interval '1 hour'
    and (case when p_verein_id is not null then m.verein_id = p_verein_id else m.user_id = auth.uid() and m.verein_id is null end);
  -- Zentrale Pruefung: Bereich aktiv, TanzRaum-Gesamtspeicher, Kontingent aus speicher_kontingente
  perform speicher_pruefen(case when p_verein_id is not null then 'musik_verein' else 'musik_persoenlich' end,
                           musik_belegt(p_verein_id, auth.uid()), p_groesse, p_verein_id is not null);

  v_pfad := case when p_verein_id is not null then 'verein/' || p_verein_id else 'user/' || auth.uid() end || '/' || v_id || '.' || v_endung;
  insert into musik_titel (id, verein_id, user_id, titel, interpret, art, gruppen, datei_pfad, datei_name, groesse_bytes, mime_type, erstellt_von)
  values (v_id, p_verein_id, case when p_verein_id is null then auth.uid() end,
          coalesce(nullif(left(btrim(coalesce(p_titel, '')), 120), ''), left(regexp_replace(coalesce(p_name, 'Titel'), '\.[A-Za-z0-9]{1,5}$', ''), 120)),
          nullif(left(btrim(coalesce(p_interpret, '')), 120), ''),
          case when p_art in ('training', 'auftritt', 'einlauf', 'sonstiges') then p_art else 'training' end,
          case when p_verein_id is null then '{}' else coalesce(p_gruppen, '{}') end,
          v_pfad, left(coalesce(p_name, ''), 160), p_groesse, left(p_mime, 80), auth.uid());
  return jsonb_build_object('id', v_id, 'pfad', v_pfad);
end;
$$;

-- 5) Uploads direkt in Buckets: zusaetzliche RESTRICTIVE-Regel (bestehende Regeln bleiben unveraendert und gelten weiter)
create or replace function public.speicher_upload_erlaubt(p_bucket text, p_name text)
returns boolean language plpgsql stable security definer set search_path = public, storage as $$
declare
  k speicher_kontingente%rowtype;
  v_kat text;
begin
  if not speicher_gesamt_frei(0) then
    return false;
  end if;
  v_kat := speicher_kategorie(p_bucket, p_name);
  if v_kat is null then
    return true;
  end if;
  select * into k from speicher_kontingente where schluessel = v_kat;
  if not k.aktiv then
    return false;
  end if;
  if k.pruefung <> 'storage' then
    return true; -- TeamCloud/Musik: exakt bei der Reservierung geprueft (nur reservierte Pfade sind hochladbar)
  end if;
  return speicher_bereich_belegt(v_kat, auth.uid(), case when k.bezug = 'verein' then speicher_pfad_verein(p_name) end)
         < k.limit_mb::bigint * 1048576;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Speicher: Kontingente und Gesamtspeicher') then
    create policy "Speicher: Kontingente und Gesamtspeicher" on storage.objects as restrictive for insert to authenticated, anon
      with check (public.speicher_upload_erlaubt(bucket_id, name));
  end if;
end $$;

-- Genaue Vorpruefung vor einem direkten Upload (Groesse bekannt) – fuer eine verstaendliche Meldung im Browser.
-- Die verbindliche Grenze setzt die Regel oben; Vereinsbelegung nur fuer Mitglieder des Vereins.
create or replace function public.speicher_vorpruefung(p_bucket text, p_pfad text, p_groesse bigint)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare
  k speicher_kontingente%rowtype;
  v_kat text := speicher_kategorie(p_bucket, p_pfad);
  v_verein uuid;
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet.' using errcode = '42501';
  end if;
  if v_kat is null then
    if not speicher_gesamt_frei(p_groesse) then
      raise exception 'Der TanzRaum-Speicher ist derzeit voll. Neue Uploads sind vorübergehend nicht möglich – bestehende Dateien bleiben erhalten.' using errcode = 'P0001';
    end if;
    return true;
  end if;
  select * into k from speicher_kontingente where schluessel = v_kat;
  if k.pruefung <> 'storage' then
    return true;
  end if;
  if k.bezug = 'verein' then
    v_verein := speicher_pfad_verein(p_pfad);
    if v_verein is null or not exists (select 1 from vereins_mitglieder vm where vm.verein_id = v_verein and vm.user_id = auth.uid()) then
      return true; -- keine Auskunft ueber fremde Vereine; Speicherregeln gelten trotzdem
    end if;
  end if;
  perform speicher_pruefen(v_kat, speicher_bereich_belegt(v_kat, auth.uid(), v_verein), coalesce(p_groesse, 0), k.bezug = 'verein');
  return true;
end;
$$;

-- Oeffentliche Kontingentwerte (z. B. Tarifseite, Hinweise) – nur Werte, keine Belegung
create or replace function public.speicher_kontingente_oeffentlich()
returns table (schluessel text, bezeichnung text, limit_mb integer, aktiv boolean)
language sql stable security definer set search_path = public as $$
  select k.schluessel, k.bezeichnung, k.limit_mb, k.aktiv from speicher_kontingente k order by k.reihenfolge;
$$;

-- 6) Administration: Uebersicht und Aenderung (nur TanzRaum-Admin)
create or replace function public.admin_speicher_uebersicht()
returns jsonb language plpgsql stable security definer set search_path = public, storage as $$
declare
  e plattform_einstellungen%rowtype;
  v_kat jsonb;
  v_top_vereine jsonb;
  v_top_nutzer jsonb;
begin
  if not ist_plattform_admin_aktuell() then
    raise exception 'Nur für die TanzRaum-Administration.' using errcode = '42501';
  end if;
  select * into e from plattform_einstellungen where id;
  with o as (
    select (o.metadata ->> 'size')::bigint as groesse, speicher_kategorie(o.bucket_id, o.name) as kat from storage.objects o
  ), je as (
    select kat, count(*) as anzahl, coalesce(sum(groesse), 0)::bigint as bytes from o group by kat
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'schluessel', k.schluessel, 'bezeichnung', k.bezeichnung, 'beschreibung', k.beschreibung, 'bezug', k.bezug,
      'pruefung', k.pruefung, 'buckets', to_jsonb(k.buckets), 'limit_mb', k.limit_mb, 'aktiv', k.aktiv,
      'belegt', coalesce(je.bytes, 0), 'dateien', coalesce(je.anzahl, 0), 'geaendert_am', k.geaendert_am) order by k.reihenfolge), '[]'::jsonb)
  into v_kat
  from speicher_kontingente k left join je on je.kat = k.schluessel;

  select coalesce(jsonb_agg(x order by (x ->> 'belegt')::bigint desc), '[]'::jsonb) into v_top_vereine from (
    select jsonb_build_object('name', v.name, 'belegt', sum((o.metadata ->> 'size')::bigint)) as x
    from storage.objects o join vereine v on v.id = speicher_pfad_verein(o.name)
    where speicher_kategorie(o.bucket_id, o.name) in (select schluessel from speicher_kontingente where bezug = 'verein')
    group by v.id, v.name order by sum((o.metadata ->> 'size')::bigint) desc limit 5) t;

  select coalesce(jsonb_agg(x order by (x ->> 'belegt')::bigint desc), '[]'::jsonb) into v_top_nutzer from (
    select jsonb_build_object('name', profil_name(p.id), 'belegt', sum((o.metadata ->> 'size')::bigint)) as x
    from storage.objects o join profiles p on p.id::text = o.owner_id
    where speicher_kategorie(o.bucket_id, o.name) in (select schluessel from speicher_kontingente where bezug = 'person')
    group by p.id order by sum((o.metadata ->> 'size')::bigint) desc limit 5) t;

  return jsonb_build_object(
    'gesamt_mb', e.speicher_gesamt_mb,
    'technisch_mb', e.speicher_technisch_mb,
    'belegt', speicher_gesamt_belegt(),
    'dateien', (select count(*) from storage.objects),
    'nutzer', (select count(distinct o.owner_id) from storage.objects o where o.owner_id is not null),
    'vereine', (select count(distinct speicher_pfad_verein(o.name)) from storage.objects o
                where speicher_kategorie(o.bucket_id, o.name) in (select schluessel from speicher_kontingente where bezug = 'verein')),
    'sonstige', (select coalesce(sum((o.metadata ->> 'size')::bigint), 0) from storage.objects o where speicher_kategorie(o.bucket_id, o.name) is null),
    'kategorien', v_kat,
    'top_vereine', v_top_vereine,
    'top_nutzer', v_top_nutzer);
end;
$$;

create or replace function public.admin_speicher_speichern(p_gesamt_mb integer, p_technisch_mb integer, p_kontingente jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  e plattform_einstellungen%rowtype;
  k speicher_kontingente%rowtype;
  x jsonb;
  v_limit integer;
  v_aktiv boolean;
  v_aenderungen integer := 0;
begin
  if not ist_plattform_admin_aktuell() then
    raise exception 'Nur für die TanzRaum-Administration.' using errcode = '42501';
  end if;
  if p_gesamt_mb is null or p_gesamt_mb < 1 or p_gesamt_mb > 1000000000 then
    raise exception 'Bitte einen gültigen Gesamtspeicher in MB angeben.' using errcode = 'P0001';
  end if;
  if p_technisch_mb is not null and (p_technisch_mb < 1 or p_technisch_mb > 1000000000) then
    raise exception 'Bitte einen gültigen technischen Speicher in MB angeben (oder leer lassen).' using errcode = 'P0001';
  end if;
  if p_kontingente is not null and jsonb_typeof(p_kontingente) <> 'array' then
    raise exception 'Ungültige Kontingente.' using errcode = 'P0001';
  end if;

  select * into e from plattform_einstellungen where id for update;
  if e.speicher_gesamt_mb is distinct from p_gesamt_mb or e.speicher_technisch_mb is distinct from p_technisch_mb then
    update plattform_einstellungen set speicher_gesamt_mb = p_gesamt_mb, speicher_technisch_mb = p_technisch_mb,
      geaendert_am = now(), geaendert_von = auth.uid() where id;
    if e.speicher_gesamt_mb is distinct from p_gesamt_mb then
      perform protokollieren('speicher_geaendert', null, jsonb_build_object('bereich', 'TanzRaum-Gesamtspeicher', 'alt_mb', e.speicher_gesamt_mb, 'neu_mb', p_gesamt_mb));
      v_aenderungen := v_aenderungen + 1;
    end if;
    if e.speicher_technisch_mb is distinct from p_technisch_mb then
      perform protokollieren('speicher_geaendert', null, jsonb_build_object('bereich', 'Technischer Speicher', 'alt_mb', e.speicher_technisch_mb, 'neu_mb', p_technisch_mb));
      v_aenderungen := v_aenderungen + 1;
    end if;
  end if;

  for x in select * from jsonb_array_elements(coalesce(p_kontingente, '[]'::jsonb)) loop
    select * into k from speicher_kontingente where schluessel = x ->> 'schluessel' for update;
    if not found then
      raise exception 'Unbekannter Speicherbereich.' using errcode = 'P0001';
    end if;
    begin
      v_limit := (x ->> 'limit_mb')::integer;
    exception when others then
      raise exception 'Bitte für „%“ eine ganze Zahl in MB angeben.', k.bezeichnung using errcode = 'P0001';
    end;
    if v_limit is null or v_limit < 0 or v_limit > 1000000000 then
      raise exception 'Bitte für „%“ einen Wert zwischen 0 und 1.000.000.000 MB angeben.', k.bezeichnung using errcode = 'P0001';
    end if;
    v_aktiv := coalesce((x ->> 'aktiv')::boolean, k.aktiv);
    if v_limit <> k.limit_mb or v_aktiv <> k.aktiv then
      update speicher_kontingente set limit_mb = v_limit, aktiv = v_aktiv, geaendert_am = now(), geaendert_von = auth.uid()
      where schluessel = k.schluessel;
      perform protokollieren('speicher_geaendert', null, jsonb_build_object('bereich', k.bezeichnung, 'schluessel', k.schluessel,
        'alt_mb', k.limit_mb, 'neu_mb', v_limit, 'alt_aktiv', k.aktiv, 'neu_aktiv', v_aktiv));
      v_aenderungen := v_aenderungen + 1;
    end if;
  end loop;
  return jsonb_build_object('aenderungen', v_aenderungen);
end;
$$;

-- 7) Rechte
revoke all on function public.speicher_groesse_text(bigint), public.speicher_limit_bytes(text), public.speicher_gesamt_belegt(),
  public.speicher_gesamt_frei(bigint), public.speicher_pfad_verein(text), public.speicher_kategorie(text, text),
  public.speicher_bereich_belegt(text, uuid, uuid), public.speicher_pruefen(text, bigint, bigint, boolean),
  public.speicher_upload_erlaubt(text, text), public.speicher_vorpruefung(text, text, bigint),
  public.speicher_kontingente_oeffentlich(), public.admin_speicher_uebersicht(), public.admin_speicher_speichern(integer, integer, jsonb)
  from public, anon, authenticated;
-- Speicherregel auf storage.objects: wird mit der Rolle der hochladenden Person ausgewertet
grant execute on function public.speicher_upload_erlaubt(text, text) to authenticated, anon;
grant execute on function public.speicher_vorpruefung(text, text, bigint), public.admin_speicher_uebersicht(),
  public.admin_speicher_speichern(integer, integer, jsonb) to authenticated;
grant execute on function public.speicher_kontingente_oeffentlich(), public.speicher_groesse_text(bigint) to anon, authenticated;
grant execute on all functions in schema public to service_role;
-- Bestehende Funktionen behalten ihre Rechte (teamcloud_limit/musik_limit wie bisher fuer authenticated ausfuehrbar)
