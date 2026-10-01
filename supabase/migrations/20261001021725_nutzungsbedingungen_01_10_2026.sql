-- Neue Fassung der Nutzungsbedingungen: interner Hinweis entfernt, Leistungen je Tarif in der Lizenzübersicht.
-- Die vorherige Fassung (30.09.2026) bleibt 14 Tage zulaessig (nutzungsbedingungen_zulaessig).
insert into public.rechtstext_versionen (art, version, gueltig_ab, aenderungshinweis)
select 'nutzungsbedingungen', '01.10.2026', timestamptz '2026-10-01 00:00:00+00',
       'Tarife: Leistungen je Tarif in der Lizenzübersicht, Kennzeichnung „bald“ für noch nicht freigeschaltete Bereiche'
where not exists (select 1 from public.rechtstext_versionen where art = 'nutzungsbedingungen' and version = '01.10.2026');
