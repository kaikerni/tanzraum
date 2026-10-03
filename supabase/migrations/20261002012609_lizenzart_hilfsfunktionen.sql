create or replace function public.abo_lizenzart(a public.abos)
 returns text
 language sql
 immutable
 set search_path to 'public'
as $function$
  select case
    when a.inhaber = 'verein' then 'VEREIN'
    when a.freischaltung = 'team_free' then 'TEAM_FREE'
    when a.freischaltung = 'manual_free' then 'MANUAL_FREE'
    when a.freischaltung = 'manuell_bezahlt' then 'PAID_BASIC'
    when a.anbieter = 'manuell' and coalesce(a.preis_cent, 0) = 0 then 'MANUAL_FREE'
    else 'PAID_BASIC' end;
$function$;
grant execute on function public.abo_lizenzart(public.abos) to authenticated;

create or replace function public.tagesende_berlin(p_tag date)
 returns timestamptz
 language sql
 immutable
 set search_path to 'public'
as $function$
  select ((p_tag::timestamp + interval '23 hours 59 minutes') at time zone 'Europe/Berlin');
$function$;

create or replace function public.offizieller_verein_von(p_user_id uuid)
 returns uuid
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select vm.verein_id from vereins_mitglieder vm
  where vm.user_id = p_user_id and coalesce(vm.aktiv, true)
  order by vm.created_at limit 1;
$function$;
revoke all on function public.offizieller_verein_von(uuid) from public, anon, authenticated;
