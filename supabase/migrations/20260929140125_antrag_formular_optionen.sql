-- Antragsformular: Optionen fuer "bereits Mitglied bestaetigen" und das externe Verfahren des Vereins mitliefern
do $mig$
declare
  d text := pg_get_functiondef('public.antrag_formular(uuid)'::regprocedure);
  alt text := $o$    'gruppen', coalesce($o$;
  neu text := $n$    'optionen', jsonb_build_object(
      'bestehende_bestaetigen', coalesce((av.einstellungen ->> 'bestehende_bestaetigen')::boolean, true),
      'extern_text', av.einstellungen ->> 'extern_text',
      'extern_link', av.einstellungen ->> 'extern_link'),
    'gruppen', coalesce($n$;
begin
  if (length(d) - length(replace(d, alt, ''))) / length(alt) <> 1 then
    raise exception 'antrag_formular: erwarteter Ausdruck nicht genau einmal gefunden';
  end if;
  execute replace(d, alt, neu);
end
$mig$;
