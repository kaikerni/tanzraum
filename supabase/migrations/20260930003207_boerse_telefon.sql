-- Boerse: Telefonnummern auch direkt nach Text erkennen (z. B. „Ruf an 0171 1234567“)
do $mig$
declare
  d text := pg_get_functiondef('public.boerse_angebot_speichern(uuid, jsonb)'::regprocedure);
  alt text := $o$~ '(\+49|0049|\m0)1[5-7][0-9]{7,9}'$o$;
  neu text := $n$~ '(\+49|0049|(^|[^0-9])0)1[5-7][0-9]{7,9}'$n$;
begin
  if position(alt in d) = 0 then raise exception 'boerse_angebot_speichern: Ausdruck nicht gefunden'; end if;
  execute replace(d, alt, neu);
end
$mig$;
