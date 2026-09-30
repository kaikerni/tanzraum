-- Musik: Vereinsmusik (Vereinslizenz; Vereinsadmin/Trainer verwalten, Mitglieder der zugeordneten Gruppen und ihre
-- Eltern hoeren) und persoenliche Musik (ab BASIC, nur fuer sich selbst). Dateien im privaten Bucket "musik",
-- Anzeige nur ueber kurzlebige signierte Links. Die TanzRaum-Plattformadministration hat keinen Zugriff.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('musik', 'musik', false, 31457280,
  array['audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/wav', 'audio/x-wav', 'audio/wave', 'audio/ogg', 'audio/webm', 'audio/flac', 'audio/x-flac'])
on conflict (id) do nothing;

create table public.musik_titel (
  id uuid primary key default gen_random_uuid(),
  verein_id uuid references public.vereine(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  titel text not null check (char_length(btrim(titel)) between 1 and 120),
  interpret text check (char_length(interpret) <= 120),
  art text not null default 'training' check (art in ('training', 'auftritt', 'einlauf', 'sonstiges')),
  gruppen uuid[] not null default '{}',
  bpm integer check (bpm between 20 and 300),
  notiz text check (char_length(notiz) <= 500),
  datei_pfad text not null unique,
  datei_name text check (char_length(datei_name) <= 160),
  groesse_bytes bigint not null default 0,
  mime_type text,
  hochgeladen boolean not null default false,
  erstellt_von uuid references auth.users(id) on delete set null,
  erstellt_am timestamptz not null default now(),
  aktualisiert_am timestamptz not null default now(),
  constraint musik_titel_besitz check ((verein_id is null) <> (user_id is null))
);
create index musik_titel_verein_idx on public.musik_titel (verein_id) where verein_id is not null;
create index musik_titel_user_idx on public.musik_titel (user_id) where user_id is not null;
alter table public.musik_titel enable row level security;

-- Verwalten: Vereinsadmin/Trainer eines Vereins mit Lizenz
create or replace function public.darf_musik_verwalten(p_verein_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select verein_hat_lizenz(p_verein_id) and is_verein_admin_oder_trainer(p_verein_id);
$$;

-- Hoeren: Verwaltung oder (aktive) Mitglieder bzw. Eltern von Mitgliedern der zugeordneten Gruppen (keine Gruppe = ganzer Verein)
create or replace function public.musik_hoerbar(p_verein_id uuid, p_gruppen uuid[])
returns boolean language sql stable security definer set search_path = public as $$
  with meine as (
    select vm.id from vereins_mitglieder vm
     where vm.verein_id = p_verein_id and vm.user_id = auth.uid() and coalesce(vm.aktiv, true) and vm.aufnahme_status = 'aufgenommen'
    union
    select ekz.kind_vm_id from eltern_kind_zuordnung ekz
      join vereins_mitglieder ve on ve.id = ekz.eltern_vm_id
     where ve.user_id = auth.uid() and ekz.verein_id = p_verein_id
  )
  select darf_musik_verwalten(p_verein_id)
      or (verein_hat_lizenz(p_verein_id) and exists (select 1 from meine)
          and (cardinality(p_gruppen) = 0
               or exists (select 1 from gruppen_mitglieder gm where gm.gruppe_id = any(p_gruppen) and gm.vereins_mitglied_id in (select id from meine))));
$$;

create or replace function public.musik_limit(p_verein_id uuid)
returns bigint language sql immutable set search_path = public as $$
  select case when p_verein_id is null then 209715200::bigint else 1073741824::bigint end;
$$;

create or replace function public.musik_belegt(p_verein_id uuid, p_user_id uuid)
returns bigint language sql stable security definer set search_path = public as $$
  select coalesce(sum(groesse_bytes), 0)::bigint from musik_titel
   where case when p_verein_id is not null then verein_id = p_verein_id else user_id = p_user_id and verein_id is null end;
$$;

create or replace function public.musik_speicher(p_verein_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if p_verein_id is not null and not darf_musik_verwalten(p_verein_id) then
    raise exception 'Keine Berechtigung' using errcode = '42501';
  end if;
  return jsonb_build_object('belegt', musik_belegt(p_verein_id, auth.uid()), 'limit', musik_limit(p_verein_id));
end;
$$;

create policy "Musik: hoeren bzw. eigene" on public.musik_titel for select to authenticated
  using (hochgeladen and ((verein_id is not null and musik_hoerbar(verein_id, gruppen)) or (user_id is not null and user_id = auth.uid())));
create policy "Musik: verwalten aendert" on public.musik_titel for update to authenticated
  using ((verein_id is not null and darf_musik_verwalten(verein_id)) or (user_id is not null and user_id = auth.uid()))
  with check ((verein_id is not null and darf_musik_verwalten(verein_id)) or (user_id is not null and user_id = auth.uid()));
create policy "Musik: verwalten loescht" on public.musik_titel for delete to authenticated
  using ((verein_id is not null and darf_musik_verwalten(verein_id)) or (user_id is not null and user_id = auth.uid()));
-- Anlegen nur ueber musik_upload_vorbereiten; aendern nur die beschreibenden Spalten
revoke insert, update on public.musik_titel from authenticated, anon;
grant select, delete on public.musik_titel to authenticated;
grant update (titel, interpret, art, gruppen, bpm, notiz) on public.musik_titel to authenticated;

create or replace function public.musik_titel_pruefen()
returns trigger language plpgsql set search_path = public as $$
begin
  new.titel := btrim(new.titel);
  new.gruppen := array(select distinct g from unnest(coalesce(new.gruppen, '{}')) g);
  if new.verein_id is null and cardinality(new.gruppen) > 0 then
    raise exception 'Gruppen gibt es nur bei Vereinsmusik.' using errcode = 'P0001';
  end if;
  if new.verein_id is not null and exists (select 1 from unnest(new.gruppen) g where not exists (select 1 from gruppen x where x.id = g and x.verein_id = new.verein_id)) then
    raise exception 'Gruppe gehört nicht zum Verein.' using errcode = '42501';
  end if;
  new.aktualisiert_am := now();
  return new;
end;
$$;
create trigger musik_titel_pruefen before insert or update on public.musik_titel
  for each row execute function public.musik_titel_pruefen();

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
  if musik_belegt(p_verein_id, auth.uid()) + p_groesse > musik_limit(p_verein_id) then
    raise exception 'Der Musikspeicher ist voll (% MB). Bitte zuerst alte Titel löschen.', musik_limit(p_verein_id) / 1024 / 1024 using errcode = 'P0001';
  end if;

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

create or replace function public.musik_upload_abschliessen(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public, storage as $$
declare
  m musik_titel%rowtype;
  v_groesse bigint;
  v_mime text;
begin
  select * into m from musik_titel where id = p_id and erstellt_von = auth.uid() for update;
  if not found then
    raise exception 'Upload nicht gefunden.' using errcode = 'P0001';
  end if;
  if m.hochgeladen then
    return jsonb_build_object('id', m.id);
  end if;
  select (o.metadata ->> 'size')::bigint, o.metadata ->> 'mimetype' into v_groesse, v_mime
  from storage.objects o where o.bucket_id = 'musik' and o.name = m.datei_pfad;
  if v_groesse is null then
    raise exception 'Die Datei ist noch nicht angekommen. Bitte erneut versuchen.' using errcode = 'P0001';
  end if;
  if v_groesse > 31457280 or musik_belegt(m.verein_id, m.user_id) - m.groesse_bytes + v_groesse > musik_limit(m.verein_id) then
    raise exception 'Der Speicher reicht für diese Datei nicht aus.' using errcode = 'P0001';
  end if;
  update musik_titel set groesse_bytes = v_groesse, mime_type = coalesce(nullif(v_mime, ''), mime_type), hochgeladen = true where id = p_id;
  return jsonb_build_object('id', p_id);
end;
$$;

create or replace function public.musik_reserviert(p_pfad text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from musik_titel m where m.datei_pfad = p_pfad and not m.hochgeladen and m.erstellt_von = auth.uid());
$$;

create or replace function public.musik_datei_sichtbar(p_pfad text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from musik_titel m where m.datei_pfad = p_pfad and m.hochgeladen
    and ((m.verein_id is not null and musik_hoerbar(m.verein_id, m.gruppen)) or (m.user_id is not null and m.user_id = auth.uid())));
$$;

create or replace function public.musik_datei_loeschbar(p_pfad text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from musik_titel m where m.datei_pfad = p_pfad
    and ((m.verein_id is not null and darf_musik_verwalten(m.verein_id)) or (m.user_id is not null and m.user_id = auth.uid())))
    or musik_reserviert(p_pfad)
    -- Datei ohne Eintrag (Eintrag bereits geloescht): eigener bzw. verwalteter Ordner
    or (not exists (select 1 from musik_titel m where m.datei_pfad = p_pfad)
        and (((storage.foldername(p_pfad))[1] = 'user' and (storage.foldername(p_pfad))[2] = auth.uid()::text)
          or ((storage.foldername(p_pfad))[1] = 'verein' and darf_musik_verwalten(((storage.foldername(p_pfad))[2])::uuid))));
$$;

create policy "Musik hochladen: reservierte Pfade" on storage.objects for insert to authenticated
  with check (bucket_id = 'musik' and public.musik_reserviert(name));
create policy "Musik lesen: hoerberechtigt" on storage.objects for select to authenticated
  using (bucket_id = 'musik' and public.musik_datei_sichtbar(name));
create policy "Musik loeschen: Verwaltung bzw. eigene" on storage.objects for delete to authenticated
  using (bucket_id = 'musik' and public.musik_datei_loeschbar(name));

revoke all on function public.darf_musik_verwalten(uuid), public.musik_hoerbar(uuid, uuid[]), public.musik_limit(uuid),
  public.musik_belegt(uuid, uuid), public.musik_speicher(uuid), public.musik_upload_vorbereiten(uuid, text, text, bigint, text, text, text, uuid[]),
  public.musik_upload_abschliessen(uuid), public.musik_reserviert(text), public.musik_datei_sichtbar(text), public.musik_datei_loeschbar(text)
  from public, anon;
grant execute on function public.darf_musik_verwalten(uuid), public.musik_hoerbar(uuid, uuid[]), public.musik_limit(uuid),
  public.musik_speicher(uuid), public.musik_upload_vorbereiten(uuid, text, text, bigint, text, text, text, uuid[]),
  public.musik_upload_abschliessen(uuid), public.musik_reserviert(text), public.musik_datei_sichtbar(text), public.musik_datei_loeschbar(text)
  to authenticated;
revoke execute on function public.musik_belegt(uuid, uuid) from authenticated;
