-- TeamCloud (Dateien): 500 MB je Verein, 100 MB fuer persoenliche Dateien, max. 50 MB je Datei.
-- Hochladen in den Verein: Vereinsadmin und Trainer. Ansehen/Herunterladen: aufgenommene Mitglieder.
-- Ablauf: 1) teamcloud_upload_vorbereiten (Rechte + Speicher pruefen, Platz reservieren)
--         2) Upload in den Bucket "vereins-dateien" – nur auf den reservierten Pfad
--         3) teamcloud_upload_abschliessen (tatsaechliche Groesse aus dem Speicher pruefen)

alter table public.dateien add column if not exists hochgeladen boolean not null default true;
create index if not exists dateien_verein_idx on public.dateien (verein_id) where verein_id is not null;
create index if not exists dateien_user_idx on public.dateien (user_id) where user_id is not null;
create unique index if not exists dateien_storage_path_uidx on public.dateien (storage_path);

-- Einzelne Dateien hoechstens 50 MB (zusaetzlich zur Pruefung beim Abschliessen)
update storage.buckets set file_size_limit = 52428800 where id = 'vereins-dateien';

-- Speichergrenzen an einer Stelle
create or replace function public.teamcloud_limit(p_verein_id uuid)
 returns bigint
 language sql
 immutable
 set search_path to 'public'
as $function$
  select case when p_verein_id is not null then 500::bigint * 1024 * 1024 else 100::bigint * 1024 * 1024 end;
$function$;

-- Hochladen/Loeschen in der Vereins-TeamCloud: Vereinsadmin und Trainer (aufgenommen, aktiv, Lizenz, Bereich an)
create or replace function public.darf_teamcloud(p_verein_id uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select verein_hat_lizenz(p_verein_id)
    and not exists (select 1 from vereine v where v.id = p_verein_id and 'dateien' = any(v.module_aus))
    and exists (
      select 1 from vereins_mitglieder vm join rollen r on r.id = vm.rolle_id
      where vm.verein_id = p_verein_id and vm.user_id = auth.uid() and coalesce(vm.aktiv, true)
        and vm.aufnahme_status = 'aufgenommen' and rollen_typ(r.name) in ('admin', 'trainer'));
$function$;

-- Ansehen: aufgenommene, aktive Mitglieder eines lizenzierten Vereins mit eingeschaltetem Bereich
create or replace function public.sieht_teamcloud(p_verein_id uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select verein_hat_lizenz(p_verein_id)
    and not exists (select 1 from vereine v where v.id = p_verein_id and 'dateien' = any(v.module_aus))
    and exists (
      select 1 from vereins_mitglieder vm
      where vm.verein_id = p_verein_id and vm.user_id = auth.uid() and coalesce(vm.aktiv, true) and vm.aufnahme_status = 'aufgenommen');
$function$;

-- Persoenliche Dateien: ab BASIC
create or replace function public.darf_eigene_dateien()
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select auth.uid() is not null and tarif_stufe(auth.uid()) in ('basic', 'verein');
$function$;

-- Belegter Speicher (abgeschlossene Uploads + Reservierungen der letzten Stunde)
create or replace function public.teamcloud_belegt(p_verein_id uuid, p_user_id uuid)
 returns bigint
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select coalesce(sum(d.groesse_bytes), 0)::bigint from dateien d
  where (case when p_verein_id is not null then d.verein_id = p_verein_id else d.user_id = p_user_id and d.verein_id is null end)
    and (d.hochgeladen or d.hochgeladen_am > now() - interval '1 hour');
$function$;

create or replace function public.teamcloud_speicher(p_verein_id uuid default null)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
begin
  if p_verein_id is not null and not (sieht_teamcloud(p_verein_id) or ist_plattform_admin_aktuell()) then
    raise exception 'Kein Zugriff auf diese TeamCloud.' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'belegt', teamcloud_belegt(p_verein_id, auth.uid()),
    'limit', teamcloud_limit(p_verein_id),
    'dateien', (select count(*) from dateien d where d.hochgeladen
                  and (case when p_verein_id is not null then d.verein_id = p_verein_id else d.user_id = auth.uid() and d.verein_id is null end)),
    'darf_hochladen', case when p_verein_id is not null then darf_teamcloud(p_verein_id) else darf_eigene_dateien() end);
end;
$function$;

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

  if teamcloud_belegt(p_verein_id, auth.uid()) + p_groesse > v_limit then
    raise exception 'Der Speicher ist voll (% MB). Bitte zuerst alte Dateien löschen.', v_limit / 1024 / 1024 using errcode = 'P0001';
  end if;

  v_sicher := coalesce(nullif(left(regexp_replace(v_name, '[^A-Za-z0-9._-]+', '-', 'g'), 80), ''), 'datei');
  v_pfad := case when p_verein_id is not null then 'verein/' || p_verein_id else 'user/' || auth.uid() end || '/' || v_id || '/' || v_sicher;

  insert into dateien (id, verein_id, user_id, ordner_pfad, name, storage_path, groesse_bytes, mime_type, ist_medien, hochgeladen_von, hochgeladen_am, hochgeladen)
  values (v_id, p_verein_id, case when p_verein_id is null then auth.uid() end, nullif(v_ordner, ''), v_name, v_pfad, p_groesse,
          left(coalesce(p_mime, ''), 120), coalesce(p_mime, '') ~* '^(audio|video|image)/', auth.uid(), now(), false);
  return jsonb_build_object('id', v_id, 'pfad', v_pfad);
end;
$function$;

create or replace function public.teamcloud_upload_abschliessen(p_id uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'storage'
as $function$
declare
  d dateien%rowtype;
  v_groesse bigint;
  v_mime text;
begin
  select * into d from dateien where id = p_id and hochgeladen_von = auth.uid() for update;
  if not found then
    raise exception 'Upload nicht gefunden.' using errcode = 'P0001';
  end if;
  if d.hochgeladen then
    return jsonb_build_object('id', d.id, 'groesse', d.groesse_bytes);
  end if;
  select (o.metadata ->> 'size')::bigint, o.metadata ->> 'mimetype' into v_groesse, v_mime
  from storage.objects o where o.bucket_id = 'vereins-dateien' and o.name = d.storage_path;
  if v_groesse is null then
    raise exception 'Die Datei ist noch nicht angekommen. Bitte erneut versuchen.' using errcode = 'P0001';
  end if;
  if v_groesse > 52428800
     or teamcloud_belegt(d.verein_id, d.user_id) - d.groesse_bytes + v_groesse > teamcloud_limit(d.verein_id) then
    raise exception 'Der Speicher reicht für diese Datei nicht aus.' using errcode = 'P0001';
  end if;
  update dateien set groesse_bytes = v_groesse, mime_type = coalesce(nullif(v_mime, ''), mime_type),
    ist_medien = coalesce(nullif(v_mime, ''), mime_type) ~* '^(audio|video|image)/', hochgeladen = true, hochgeladen_am = now()
  where id = p_id;
  return jsonb_build_object('id', p_id, 'groesse', v_groesse);
end;
$function$;

-- Reservierter, noch nicht abgeschlossener Upload der angemeldeten Person (fuer die Speicher-Regeln)
create or replace function public.teamcloud_reserviert(p_pfad text)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select exists (select 1 from dateien d where d.storage_path = p_pfad and not d.hochgeladen and d.hochgeladen_von = auth.uid());
$function$;

-- Tabelle: nur ueber die Funktionen schreiben; lesen nach Vereins-/Eigentumsregeln
drop policy if exists "Berechtigte laden Dateien hoch" on public.dateien;
drop policy if exists "Berechtigte loeschen Dateien" on public.dateien;
drop policy if exists "Vereinsmitglieder sehen Vereinsdateien" on public.dateien;
create policy "Vereinsmitglieder sehen Vereinsdateien" on public.dateien for select to authenticated
  using (hochgeladen and (
    (verein_id is not null and sieht_teamcloud(verein_id))
    or (user_id is not null and verein_id is null and user_id = auth.uid())
    or (turnier_id is not null and juryraum_sieht_turnier(turnier_id))));
create policy "Berechtigte loeschen Dateien" on public.dateien for delete to authenticated
  using ((verein_id is not null and darf_teamcloud(verein_id))
    or (user_id is not null and verein_id is null and user_id = auth.uid())
    or (turnier_id is not null and juryraum_verwaltet_turnier(turnier_id)));
-- JuryRaum-Dokumente werden weiter direkt eingetragen (bisheriges Verhalten)
create policy "Berechtigte laden Dateien hoch" on public.dateien for insert to authenticated
  with check (turnier_id is not null and juryraum_verwaltet_turnier(turnier_id) and hochgeladen_von = auth.uid());

-- Speicher: Hochladen nur auf reservierte Pfade; Lesen/Loeschen nach denselben Regeln
drop policy if exists "Hochladen: Berechtigte" on storage.objects;
drop policy if exists "Lesen: eigene oder Vereins-Dateien" on storage.objects;
drop policy if exists "Loeschen: Berechtigte" on storage.objects;
create policy "Hochladen: Berechtigte" on storage.objects for insert to authenticated
  with check (bucket_id = 'vereins-dateien' and public.teamcloud_reserviert(name));
create policy "Lesen: eigene oder Vereins-Dateien" on storage.objects for select to authenticated
  using (bucket_id = 'vereins-dateien' and (
    ((storage.foldername(name))[1] = 'verein' and public.sieht_teamcloud(((storage.foldername(name))[2])::uuid))
    or ((storage.foldername(name))[1] = 'user' and ((storage.foldername(name))[2])::uuid = auth.uid())));
create policy "Loeschen: Berechtigte" on storage.objects for delete to authenticated
  using (bucket_id = 'vereins-dateien' and (
    ((storage.foldername(name))[1] = 'verein' and public.darf_teamcloud(((storage.foldername(name))[2])::uuid))
    or ((storage.foldername(name))[1] = 'user' and ((storage.foldername(name))[2])::uuid = auth.uid())
    or public.teamcloud_reserviert(name)));

revoke execute on function public.teamcloud_belegt(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.teamcloud_reserviert(text) from public, anon;
grant execute on function public.teamcloud_reserviert(text) to authenticated;
revoke execute on function public.darf_teamcloud(uuid), public.sieht_teamcloud(uuid), public.darf_eigene_dateien(),
  public.teamcloud_speicher(uuid), public.teamcloud_upload_vorbereiten(uuid, text, bigint, text, text),
  public.teamcloud_upload_abschliessen(uuid) from public, anon;
grant execute on function public.darf_teamcloud(uuid), public.sieht_teamcloud(uuid), public.darf_eigene_dateien(),
  public.teamcloud_speicher(uuid), public.teamcloud_upload_vorbereiten(uuid, text, bigint, text, text),
  public.teamcloud_upload_abschliessen(uuid), public.teamcloud_limit(uuid) to authenticated;
