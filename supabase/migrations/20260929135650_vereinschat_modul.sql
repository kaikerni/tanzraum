-- Vereinsbereich "chat" ausgeschaltet: Vereinschat ist fuer niemanden sichtbar/schreibbar (Nachrichten bleiben erhalten)
do $mig$
declare
  d text := pg_get_functiondef('public.hat_gespraech_zugriff(uuid)'::regprocedure);
  alt text := $o$  if g.typ = 'verein' then
    return exists ($o$;
  neu text := $n$  if g.typ = 'verein' then
    if exists (select 1 from vereine x where x.id = g.verein_id and 'chat' = any(x.module_aus)) then return false; end if;
    return exists ($n$;
begin
  if (length(d) - length(replace(d, alt, ''))) / length(alt) <> 1 then
    raise exception 'hat_gespraech_zugriff: erwarteter Ausdruck nicht genau einmal gefunden';
  end if;
  execute replace(d, alt, neu);
end
$mig$;
