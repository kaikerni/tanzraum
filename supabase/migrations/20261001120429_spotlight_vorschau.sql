-- Vorschau fuer die Story-Kacheln: neuestes sichtbares Spotlight je Person (Foto-Pfad bzw. Text-Hintergrund)
create or replace function public.spotlight_vorschaubilder()
returns table(user_id uuid, media_path text, media_typ text, hintergrund text)
language sql stable security definer set search_path = public as $$
  select distinct on (s.user_id) s.user_id, case when s.media_typ = 'foto' then s.media_path end, s.media_typ, s.hintergrund
  from spotlights s
  where s.ablauf_am > now() and s.entfernt_am is null and darf_spotlight_sehen(s.id)
  order by s.user_id, s.erstellt_am desc
  limit 100;
$$;
revoke all on function public.spotlight_vorschaubilder() from public, anon;
grant execute on function public.spotlight_vorschaubilder() to authenticated;
