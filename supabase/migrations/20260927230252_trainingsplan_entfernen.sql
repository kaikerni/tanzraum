-- Bereich "Trainingsplan" komplett entfernt (Menue, Rechte, Tarifbeschreibung).
-- Nur die beiden Listenfunktionen ohne 'trainingsplan'; Signaturen und Rechte bleiben gleich.
-- Gespeicherte Rechte mit 'trainingsplan' gab es beim Entfernen keine (vereins_mitglieder.bereiche
-- und vereins_bereichsrechte geprueft: 0 Zeilen).
create or replace function public.bereiche_fuer_rolle(p_rolle text)
 returns text[]
 language sql
 immutable
 set search_path to 'public'
as $function$
  select case rollen_typ(p_rolle)
    when 'admin' then array['mitglieder','anwesenheit','beitraege','material','saison','netzwerk','beitritt']
    when 'trainer' then array['mitglieder','anwesenheit','saison','netzwerk']
    when 'betreuer' then array['mitglieder','anwesenheit','material']
    else array[]::text[]
  end;
$function$;

create or replace function public.gueltige_bereiche()
 returns text[]
 language sql
 immutable
 set search_path to 'public'
as $function$ select array['mitglieder','anwesenheit','beitraege','material','saison','netzwerk','beitritt'] $function$;
