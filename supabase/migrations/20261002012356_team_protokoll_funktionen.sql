create or replace function public.profil_name(p_user_id uuid)
 returns text
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select coalesce(nullif(btrim(coalesce(p.vorname, '') || ' ' || coalesce(p.nachname, '')), ''), '@' || p.handle, 'Unbekannt')
  from profiles p where p.id = p_user_id;
$function$;
revoke all on function public.profil_name(uuid) from public, anon, authenticated;

create or replace function public.protokollieren(p_aktion text, p_ziel uuid, p_details jsonb default '{}'::jsonb)
 returns void
 language sql
 security definer
 set search_path to 'public'
as $function$
  insert into admin_protokoll (akteur_id, akteur_name, aktion, ziel_user_id, ziel_name, details)
  values (auth.uid(), profil_name(auth.uid()), p_aktion, p_ziel, case when p_ziel is null then null else profil_name(p_ziel) end,
          coalesce(p_details, '{}'::jsonb));
$function$;
revoke all on function public.protokollieren(text, uuid, jsonb) from public, anon, authenticated;
