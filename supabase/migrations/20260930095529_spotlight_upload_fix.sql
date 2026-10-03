-- Fix: Die Upload-Richtlinie fuer Spotlight-Fotos rief tarif_von() direkt auf; die Funktion ist fuer angemeldete Nutzer
-- nicht freigegeben ("permission denied for function tarif_von") -> jedes Hochladen scheiterte.
-- Jetzt eine eigene, freigegebene Pruef-Funktion (gleiche Regel: Spotlights fuer mich an, BASIC/VEREIN bzw. Administration).

create or replace function public.darf_spotlight_hochladen()
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null
     and spotlights_fuer_mich()
     and (ist_plattform_admin_aktuell() or coalesce(tarif_von(auth.uid()), 'free') in ('basic', 'verein'));
$$;
revoke all on function public.darf_spotlight_hochladen() from public, anon;
grant execute on function public.darf_spotlight_hochladen() to authenticated;

drop policy if exists "Nutzer laedt eigenes Spotlight-Medium hoch" on storage.objects;
create policy "Nutzer laedt eigenes Spotlight-Medium hoch" on storage.objects for insert to authenticated
  with check (bucket_id = 'spotlights' and (storage.foldername(name))[1] = (auth.uid())::text
              and public.darf_spotlight_hochladen());
