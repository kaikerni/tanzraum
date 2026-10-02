-- „befristet“ fuer manuelle Freischaltungen mit festem Enddatum (Pruefregel wird erweitert, keine Daten betroffen)
alter table public.abos drop constraint if exists abos_periode_check,
  add constraint abos_periode_check check (periode = any (array['monat', 'jahr', 'unbefristet', 'befristet']));
