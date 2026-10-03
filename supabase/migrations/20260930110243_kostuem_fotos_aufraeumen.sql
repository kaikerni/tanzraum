-- Kostüm-Fotos + nächtliches Aufräumen verwaister Dateien im Speicher + search_path für lizenz_ende

-- 1) Kostüm-Fotos: privater Speicher, Pfad <verein_id>/<kostuem_id>/<zufall>.jpg
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('kostueme', 'kostueme', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

alter table public.kostueme add column if not exists bild_pfad text check (bild_pfad is null or char_length(bild_pfad) <= 300);

-- Foto nur aus dem eigenen Vereinsordner verknüpfen
create or replace function public.kostueme_bild_pruefen()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.bild_pfad is not null and split_part(new.bild_pfad, '/', 1) <> new.verein_id::text then
    raise exception 'Ungültiges Foto.' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists kostueme_bild_pruefen on public.kostueme;
create trigger kostueme_bild_pruefen before insert or update of bild_pfad on public.kostueme for each row execute function public.kostueme_bild_pruefen();

drop policy if exists "Kostuemfotos: Verwaltung laedt hoch" on storage.objects;
create policy "Kostuemfotos: Verwaltung laedt hoch" on storage.objects for insert to authenticated
  with check (bucket_id = 'kostueme' and darf_kostueme_verwalten(((storage.foldername(name))[1])::uuid));
drop policy if exists "Kostuemfotos: Verwaltung loescht" on storage.objects;
create policy "Kostuemfotos: Verwaltung loescht" on storage.objects for delete to authenticated
  using (bucket_id = 'kostueme' and darf_kostueme_verwalten(((storage.foldername(name))[1])::uuid));
-- Sehen darf, wer das Teil sieht (Verwaltung bzw. Person/Eltern, die es gerade haben) – RLS von kostueme greift
drop policy if exists "Kostuemfotos: wer das Teil sieht" on storage.objects;
create policy "Kostuemfotos: wer das Teil sieht" on storage.objects for select to authenticated
  using (bucket_id = 'kostueme' and (darf_kostueme_verwalten(((storage.foldername(name))[1])::uuid)
         or exists (select 1 from public.kostueme k where k.bild_pfad = storage.objects.name)));

-- 2) Verwaiste Dateien: älter als 2 Tage und von keiner Zeile mehr verwendet (z. B. abgebrochene Uploads).
--    Gelöscht wird über die Storage-API (Edge Function speicher-aufraeumen), nie direkt per SQL.
create or replace function public.verwaiste_dateien(p_geheimnis text)
returns table(bucket text, pfade jsonb)
language plpgsql stable security definer set search_path = public as $$
begin
  if not interner_aufruf_ok(p_geheimnis) then
    raise exception 'Nicht berechtigt' using errcode = '42501';
  end if;
  return query
  select w.bucket_id::text, jsonb_agg(w.name)
  from (
    select o.bucket_id, o.name
    from storage.objects o
    where o.created_at < now() - interval '2 days'
      and o.name not like '%.emptyFolderPlaceholder'
      and (
           (o.bucket_id = 'vereins-dateien' and not exists (select 1 from dateien d where d.storage_path = o.name))
        or (o.bucket_id = 'boerse' and not exists (select 1 from boerse_angebote a where o.name = any(a.bilder)))
        or (o.bucket_id = 'kassenbuch-belege' and not exists (select 1 from kassenbuch_eintraege k where k.beleg_pfad = o.name))
        or (o.bucket_id = 'musik' and not exists (select 1 from musik_titel m where m.datei_pfad = o.name))
        or (o.bucket_id = 'spotlights' and not exists (select 1 from spotlights s where s.media_path = o.name))
        or (o.bucket_id = 'ehrungs-dokumente' and not exists (select 1 from mitglied_ehrung_dokumente e where e.storage_path = o.name))
        or (o.bucket_id = 'kostueme' and not exists (select 1 from kostueme k where k.bild_pfad = o.name))
      )
    order by o.created_at
    limit 500
  ) w
  group by w.bucket_id;
end;
$$;
revoke all on function public.verwaiste_dateien(text) from public, anon, authenticated;
grant execute on function public.verwaiste_dateien(text) to service_role;

-- Jede Nacht um 04:20 Uhr (UTC) – gleiches Muster wie konto-loeschungen
do $$
begin
  if exists (select 1 from cron.job where jobname = 'speicher-aufraeumen') then
    perform cron.unschedule('speicher-aufraeumen');
  end if;
  perform cron.schedule('speicher-aufraeumen', '20 4 * * *', $job$
    select net.http_post(
      url := 'https://oraiqjulxmohclfixwdq.supabase.co/functions/v1/speicher-aufraeumen',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-tanzraum-geheimnis',
                   (select decrypted_secret from vault.decrypted_secrets where name = 'chat_push_geheimnis')),
      body := '{}'::jsonb)
  $job$);
end $$;

-- 3) Sicherheitshinweis des Advisors: fester search_path
alter function public.lizenz_ende(date) set search_path = public;
