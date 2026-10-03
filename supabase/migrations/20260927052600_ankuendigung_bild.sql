-- TanzRaum-Ankuendigungen mit Bild (z. B. Cover einer neuen CD/eines Bundles) und optionalem Link-Button
--
-- - Bucket "ankuendigungen": oeffentlich lesbar (Bilder erscheinen auf allen Dashboards, keine personenbezogenen Daten),
--   hochladen/ersetzen/loeschen nur die TanzRaum-Administration; nur Bilder bis 5 MB.
-- - Link nur https (z. B. Shop-Seite der Taktmanufaktur), mit frei waehlbarer Beschriftung.

alter table public.plattform_ankuendigungen
  add column bild_pfad text check (bild_pfad is null or (char_length(bild_pfad) <= 300 and bild_pfad !~ '\.\.')),
  add column link_url text check (link_url is null or (link_url ~ '^https://[^\s]+$' and char_length(link_url) <= 500)),
  add column link_text text check (link_text is null or char_length(link_text) between 1 and 40);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ankuendigungen', 'ankuendigungen', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "Plattformadmin laedt Ankuendigungsbilder hoch" on storage.objects for insert to authenticated
  with check (bucket_id = 'ankuendigungen' and public.ist_plattform_admin_aktuell());
create policy "Plattformadmin ersetzt Ankuendigungsbilder" on storage.objects for update to authenticated
  using (bucket_id = 'ankuendigungen' and public.ist_plattform_admin_aktuell());
create policy "Plattformadmin loescht Ankuendigungsbilder" on storage.objects for delete to authenticated
  using (bucket_id = 'ankuendigungen' and public.ist_plattform_admin_aktuell());

-- Lesefunktionen um Bild und Link erweitert (Rueckgabetyp aendert sich)
drop function if exists public.meine_ankuendigungen();
create function public.meine_ankuendigungen()
 returns table(id uuid, titel text, text text, art text, wichtig boolean, sichtbar_ab timestamptz, sichtbar_bis timestamptz,
               gelesen_am timestamptz, bild_pfad text, link_url text, link_text text)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select a.id, a.titel, a.text, a.art, a.wichtig, a.sichtbar_ab, a.sichtbar_bis, g.gelesen_am, a.bild_pfad, a.link_url, a.link_text
  from plattform_ankuendigungen a
  left join plattform_ankuendigung_gelesen g on g.ankuendigung_id = a.id and g.user_id = auth.uid()
  where ankuendigung_fuer_mich(a)
  order by a.wichtig desc, a.sichtbar_ab desc
  limit 20;
$function$;

drop function if exists public.ankuendigungen_admin();
create function public.ankuendigungen_admin()
 returns table(id uuid, titel text, text text, art text, wichtig boolean, push boolean, zielgruppe text, sichtbar_ab timestamptz,
               sichtbar_bis timestamptz, erstellt_am timestamptz, gelesen integer, bild_pfad text, link_url text, link_text text)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select a.id, a.titel, a.text, a.art, a.wichtig, a.push, a.zielgruppe, a.sichtbar_ab, a.sichtbar_bis, a.erstellt_am,
         (select count(*)::int from plattform_ankuendigung_gelesen g where g.ankuendigung_id = a.id),
         a.bild_pfad, a.link_url, a.link_text
  from plattform_ankuendigungen a where ist_plattform_admin_aktuell()
  order by a.erstellt_am desc limit 100;
$function$;

revoke all on function public.meine_ankuendigungen(), public.ankuendigungen_admin() from public, anon;
grant execute on function public.meine_ankuendigungen(), public.ankuendigungen_admin() to authenticated;
