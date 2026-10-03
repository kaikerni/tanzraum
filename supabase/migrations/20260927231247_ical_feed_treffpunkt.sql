-- Kalender-Abo: Vereinstermine zeigen zusaetzlich Treffpunkt, Ansprechpartner und Mitbringen in der Beschreibung.
-- Nur dieser eine Ausdruck in ical_feed wird ersetzt (Rest der Funktion, Signatur und Rechte unveraendert).
do $mig$
declare
  d text := pg_get_functiondef('public.ical_feed(text,text)'::regprocedure);
  alt text := $o$concat_ws(E'\n', kt.verein_name, kt.beschreibung)$o$;
  neu text := $n$concat_ws(E'\n', kt.verein_name,
      (select nullif(concat_ws(E'\n',
         case when x.treffpunkt is not null or x.treffzeit is not null
              then 'Treffpunkt: ' || concat_ws(' · ', to_char(x.treffzeit, 'HH24:MI') || ' Uhr', x.treffpunkt) end,
         case when x.verantwortlich is not null then 'Ansprechpartner: ' || x.verantwortlich end,
         case when x.mitbringen is not null then 'Mitbringen: ' || x.mitbringen end), '')
       from termine x where x.id = kt.id),
      kt.beschreibung)$n$;
begin
  if (length(d) - length(replace(d, alt, ''))) / length(alt) <> 1 then
    raise exception 'ical_feed: erwarteter Ausdruck nicht genau einmal gefunden';
  end if;
  execute replace(d, alt, neu);
end
$mig$;
