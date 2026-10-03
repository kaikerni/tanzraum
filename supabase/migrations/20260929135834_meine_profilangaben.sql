-- Eigene freiwillige Profilangaben lesen (Spalten sind fuer authenticated nicht direkt lesbar)
create or replace function public.meine_profilangaben()
 returns jsonb
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select jsonb_build_object('verein_angabe', p.verein_angabe, 'online_sichtbar', p.online_sichtbar)
  from profiles p where p.id = auth.uid();
$function$;
revoke execute on function public.meine_profilangaben() from public, anon;
grant execute on function public.meine_profilangaben() to authenticated;
